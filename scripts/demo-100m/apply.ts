import { Prisma } from "../../lib/generated/prisma/client";
import { CANONICAL, DEMO_MARKER, PRODUCTION_BASELINE } from "./config";
import type { DemoDb, DemoDbTx, Row } from "./db-types";
import { minorToDecimal } from "./lib";
import { CUSTOMERS, SUPPLIERS, USER_ACCOUNTS } from "./master-data";
import { computeMetrics } from "./metrics";
import type { AuditLog, DemoDataset, UserKey } from "./types";

/*
 * DEMO 100M apply phase: writes the canonical dataset into an existing
 * database, in one transaction, after a read-only preflight. Master data is
 * only referenced (by code / SKU / demo account) and five customer fields +
 * one supplier field are updated; nothing is ever deleted.
 */

const CHUNK = 1_000;
/** Interactive transaction limits: the pooled connection can be slow to hand out; ~20k rows need minutes. */
export const APPLY_TRANSACTION_OPTIONS = { maxWait: 30_000, timeout: 15 * 60_000 } as const;
export const READ_ONLY_TRANSACTION_OPTIONS = { maxWait: 30_000, timeout: 5 * 60_000 } as const;

export class DemoApplyError extends Error {}
export class DemoAlreadyAppliedError extends DemoApplyError {
  constructor() {
    super("DEMO-100M already applied");
  }
}

export type MasterIds = {
  customer: Map<string, string>;
  supplier: Map<string, string>;
  product: Map<string, string>;
  warehouse: Map<string, string>;
  user: Map<UserKey, string>;
};

export type PreviousValues = {
  customers: { code: string; paymentTermDays: number; creditLimit: string | null; lastPurchaseAt: string | null; lastContactAt: string | null; nextActionAt: string | null }[];
  suppliers: { code: string; paymentTermDays: number }[];
};

export type PreflightResult = {
  ok: boolean;
  alreadyApplied: boolean;
  problems: string[];
  master: MasterIds;
  previous: PreviousValues;
  counts: Record<string, number>;
};

const decimal = (minor: number) => new Prisma.Decimal(minorToDecimal(minor));
const kg = (value: number) => new Prisma.Decimal(String(value));
const date = (iso: string | null) => (iso === null ? null : new Date(iso));
const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : value === null || value === undefined ? null : String(value));
const toMinor = (value: unknown) => {
  if (value === null || value === undefined) return 0;
  const text = typeof value === "object" && value !== null && "toFixed" in value ? (value as { toFixed(n: number): string }).toFixed(2) : Number(value).toFixed(2);
  const negative = text.startsWith("-");
  const [whole, frac] = text.replace("-", "").split(".");
  const minor = Number(whole) * 100 + Number(frac ?? 0);
  return negative ? -minor : minor;
};
const chunks = <T>(list: T[]) => Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) => list.slice(i * CHUNK, (i + 1) * CHUNK));

// ---------------------------------------------------------------------------
// Preflight (read only)
// ---------------------------------------------------------------------------

/** All ids the dataset will create, per table (for collision / presence checks). */
function datasetIds(ds: DemoDataset) {
  return {
    salesOrder: ds.salesOrders.map((o) => o.id),
    salesOrderItem: ds.salesOrders.flatMap((o) => o.items.map((i) => i.id)),
    batch: ds.batches.map((b) => b.id),
    stockMovement: ds.movements.map((m) => m.id),
    stockReservation: ds.reservations.map((r) => r.id),
    receivable: ds.receivables.map((r) => r.id),
    payable: ds.payables.map((p) => p.id),
    purchaseOrder: ds.purchaseOrders.map((p) => p.id),
    purchaseOrderItem: ds.purchaseOrders.flatMap((p) => p.items.map((i) => i.id)),
    auditLog: ds.auditLogs.map((a) => a.id),
  } as const;
}
type IdTable = keyof ReturnType<typeof datasetIds>;

async function countIds(tx: DemoDbTx, table: IdTable, ids: readonly string[]) {
  let total = 0;
  for (const part of chunks([...ids])) total += await tx[table].count({ where: { id: { in: part } } });
  return total;
}

export async function preflight(tx: DemoDbTx, ds: DemoDataset): Promise<PreflightResult> {
  const problems: string[] = [];
  const counts: Record<string, number> = {};

  const [customers, suppliers, products, warehouses, users] = await Promise.all([
    tx.customer.findMany({ select: { id: true, code: true, responsibleId: true, paymentTermDays: true, creditLimit: true, lastPurchaseAt: true, lastContactAt: true, nextActionAt: true } }),
    tx.supplier.findMany({ select: { id: true, code: true, paymentTermDays: true } }),
    tx.product.findMany({ select: { id: true, sku: true, isActive: true } }),
    tx.warehouse.findMany({ select: { id: true, code: true, isActive: true } }),
    tx.user.findMany({ select: { id: true, email: true, isActive: true, roles: { select: { role: { select: { code: true } } } } } }),
  ]);
  const roleCodes = (u: Row) => ((u.roles as { role: { code: string } }[] | undefined) ?? []).map((r) => r.role.code);
  counts.customers = customers.length;
  counts.suppliers = suppliers.length;
  counts.products = products.length;
  counts.warehouses = warehouses.length;
  counts.salesUsers = users.filter((u) => roleCodes(u).includes("SALES")).length;
  for (const key of ["customers", "suppliers", "products", "warehouses", "salesUsers"] as const) {
    if (counts[key] !== PRODUCTION_BASELINE[key]) problems.push(`baseline: ${key} = ${counts[key]}, expected ${PRODUCTION_BASELINE[key]}`);
  }

  const master: MasterIds = {
    customer: new Map(customers.map((c) => [String(c.code), String(c.id)])),
    supplier: new Map(suppliers.map((s) => [String(s.code), String(s.id)])),
    product: new Map(products.filter((p) => p.isActive).map((p) => [String(p.sku), String(p.id)])),
    warehouse: new Map(warehouses.filter((w) => w.isActive).map((w) => [String(w.code), String(w.id)])),
    user: new Map(),
  };
  for (const [key, account] of Object.entries(USER_ACCOUNTS) as [UserKey, { email: string; role: string }][]) {
    const user = users.find((u) => u.email === account.email);
    if (!user) problems.push(`master: demo account for "${key}" not found`);
    else if (!user.isActive || !roleCodes(user).includes(account.role)) problems.push(`master: demo account for "${key}" is inactive or lacks role ${account.role}`);
    else master.user.set(key, String(user.id));
  }

  // Every code / SKU the dataset references must resolve.
  const need = (kind: keyof Omit<MasterIds, "user">, codes: Iterable<string>) => {
    for (const code of new Set(codes)) if (!master[kind].has(code)) problems.push(`master: ${kind} ${code} missing or inactive`);
  };
  need("customer", [...ds.customerUpdates.map((c) => c.customerCode), ...ds.salesOrders.map((o) => o.customerCode)]);
  need("supplier", [...ds.supplierUpdates.map((s) => s.supplierCode), ...ds.batches.map((b) => b.supplierCode), ...ds.purchaseOrders.map((p) => p.supplierCode), ...ds.payables.map((p) => p.supplierCode)]);
  need("product", [...ds.salesOrders.flatMap((o) => o.items.map((i) => i.productSku)), ...ds.batches.map((b) => b.productSku), ...ds.purchaseOrders.flatMap((p) => p.items.map((i) => i.productSku))]);
  need("warehouse", [...ds.batches.map((b) => b.warehouseCode), ...ds.reservations.map((r) => r.warehouseCode)]);

  // Customer ownership must match the catalogue the dataset was generated from.
  for (const c of CUSTOMERS) {
    const row = customers.find((x) => x.code === c.code);
    const expected = master.user.get(c.responsible);
    if (row && expected && row.responsibleId !== expected) problems.push(`master: ${c.code} responsible differs from the demo catalogue`);
  }

  // Already applied?
  const ids = datasetIds(ds);
  const present = (await countIds(tx, "salesOrder", ids.salesOrder.slice(0, 50))) + (await countIds(tx, "batch", ids.batch.slice(0, 50))) + (await tx.salesOrder.count({ where: { notes: { contains: DEMO_MARKER } } }));
  const alreadyApplied = present > 0;

  // Operational tables must be empty (the old cancelled PO excepted), and no id may collide.
  for (const table of ["salesOrder", "salesOrderItem", "receivable", "payable", "batch", "stockMovement", "stockReservation"] as const) {
    counts[table] = await tx[table].count();
    if (counts[table] !== 0 && !alreadyApplied) problems.push(`baseline: ${table} has ${counts[table]} rows, expected 0`);
  }
  const purchaseOrders = await tx.purchaseOrder.findMany({ select: { id: true, orderNumber: true } });
  counts.purchaseOrder = purchaseOrders.length;
  const allowed = new Set<string>(PRODUCTION_BASELINE.allowedExistingPurchaseOrders);
  if (!alreadyApplied) {
    for (const po of purchaseOrders) if (!allowed.has(String(po.orderNumber))) problems.push(`baseline: unexpected purchase order ${po.orderNumber}`);
  }
  const demoNumbers = new Set(ds.purchaseOrders.map((p) => p.orderNumber));
  for (const po of purchaseOrders) if (demoNumbers.has(String(po.orderNumber)) && !alreadyApplied) problems.push(`collision: purchase order number ${po.orderNumber}`);
  if (!alreadyApplied) {
    for (const table of ["purchaseOrder", "purchaseOrderItem", "auditLog"] as const) {
      const collisions = await countIds(tx, table, ids[table]);
      if (collisions > 0) problems.push(`collision: ${collisions} ${table} id(s) already exist`);
    }
  }

  const previous: PreviousValues = {
    customers: customers
      .map((c) => ({
        code: String(c.code),
        paymentTermDays: Number(c.paymentTermDays),
        creditLimit: c.creditLimit === null || c.creditLimit === undefined ? null : String(c.creditLimit),
        lastPurchaseAt: iso(c.lastPurchaseAt),
        lastContactAt: iso(c.lastContactAt),
        nextActionAt: iso(c.nextActionAt),
      }))
      .sort((a, b) => (a.code < b.code ? -1 : 1)),
    suppliers: suppliers
      .filter((s) => ds.supplierUpdates.some((u) => u.supplierCode === s.code))
      .map((s) => ({ code: String(s.code), paymentTermDays: Number(s.paymentTermDays) }))
      .sort((a, b) => (a.code < b.code ? -1 : 1)),
  };

  return { ok: problems.length === 0 && !alreadyApplied, alreadyApplied, problems, master, previous, counts };
}

// ---------------------------------------------------------------------------
// Row mapping (dataset → database rows)
// ---------------------------------------------------------------------------

const METADATA_CODE_KEYS: Record<string, keyof Omit<MasterIds, "user">> = {
  customerCode: "customer",
  productSku: "product",
  warehouseCode: "warehouse",
  supplierCode: "supplier",
  destinationWarehouseCode: "warehouse",
};
const METADATA_ID_KEYS: Record<string, string> = {
  customerCode: "customerId",
  productSku: "productId",
  warehouseCode: "warehouseId",
  supplierCode: "supplierId",
  destinationWarehouseCode: "destinationWarehouseId",
};
const METADATA_MONEY_KEYS = new Set(["amount", "paymentAmount", "previousPaidAmount", "paidAmount", "outstandingAmount"]);

/** Audit metadata in the services' shape: master ids instead of codes, money as Decimal strings. */
export function auditMetadata(a: AuditLog, master: MasterIds): Prisma.InputJsonValue {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(a.metadata)) {
    if (key in METADATA_CODE_KEYS) out[METADATA_ID_KEYS[key]] = value === null ? null : master[METADATA_CODE_KEYS[key]].get(String(value)) ?? null;
    else if (METADATA_MONEY_KEYS.has(key) && typeof value === "number") out[key] = minorToDecimal(value);
    else out[key] = value;
  }
  return out as Prisma.InputJsonValue;
}

export function buildRows(ds: DemoDataset, master: MasterIds) {
  const id = (kind: keyof Omit<MasterIds, "user">, code: string) => master[kind].get(code)!;
  const user = (key: UserKey | null) => (key === null ? null : master.user.get(key)!);
  // updatedAt = the latest lifecycle event recorded for the entity (else its creation).
  const lastEvent = new Map<string, string>();
  for (const a of ds.auditLogs) if ((lastEvent.get(a.entityId) ?? "") < a.createdAt) lastEvent.set(a.entityId, a.createdAt);
  const updated = (entityId: string, created: string) => new Date(lastEvent.get(entityId) && lastEvent.get(entityId)! > created ? lastEvent.get(entityId)! : created);
  const supplierMeta = new Map(SUPPLIERS.map((s) => [s.code, s]));

  return {
    batches: ds.batches.map((b) => ({
      id: b.id,
      batchNumber: b.batchNumber,
      productId: id("product", b.productSku),
      receivedKg: kg(b.receivedKg),
      productionDate: new Date(b.productionDate),
      expiryDate: new Date(b.expiryDate),
      manufacturer: supplierMeta.get(b.supplierCode)?.name ?? null,
      country: supplierMeta.get(b.supplierCode)?.country ?? null,
      unitCost: b.unitCost === null ? null : decimal(b.unitCost),
      status: b.status,
      notes: b.notes,
      createdAt: new Date(b.receivedAt),
      updatedAt: new Date(b.receivedAt),
    })),
    salesOrders: ds.salesOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerId: id("customer", o.customerCode),
      responsibleId: user(o.responsible),
      status: o.status,
      orderDate: new Date(o.orderDate),
      shippedAt: date(o.shippedAt),
      currency: o.currency,
      notes: o.notes,
      createdAt: new Date(o.createdAt),
      updatedAt: updated(o.id, o.createdAt),
    })),
    salesOrderItems: ds.salesOrders.flatMap((o) =>
      o.items.map((i) => ({
        id: i.id,
        salesOrderId: o.id,
        productId: id("product", i.productSku),
        quantityKg: kg(i.quantityKg),
        pricePerKg: decimal(i.pricePerKg),
        createdAt: new Date(o.createdAt),
        updatedAt: new Date(o.createdAt),
      })),
    ),
    movements: ds.movements.map((m) => ({
      id: m.id,
      type: m.type,
      batchId: m.batchId,
      fromWarehouseId: m.fromWarehouseCode === null ? null : id("warehouse", m.fromWarehouseCode),
      toWarehouseId: m.toWarehouseCode === null ? null : id("warehouse", m.toWarehouseCode),
      quantityKg: kg(m.quantityKg),
      reference: m.reference,
      notes: m.notes,
      createdAt: new Date(m.createdAt),
    })),
    reservations: ds.reservations.map((r) => ({
      id: r.id,
      productId: id("product", r.productSku),
      batchId: r.batchId,
      warehouseId: id("warehouse", r.warehouseCode),
      salesOrderId: r.salesOrderId,
      salesOrderItemId: r.salesOrderItemId,
      quantityKg: kg(r.quantityKg),
      status: r.status,
      expiresAt: new Date(r.expiresAt),
      notes: r.notes,
      createdAt: new Date(r.createdAt),
      updatedAt: updated(r.id, r.createdAt),
    })),
    receivables: ds.receivables.map((r) => ({
      id: r.id,
      customerId: id("customer", r.customerCode),
      salesOrderId: r.salesOrderId,
      amount: decimal(r.amount),
      paidAmount: decimal(r.paidAmount),
      currency: r.currency,
      dueDate: new Date(r.dueDate),
      status: r.status,
      reference: r.reference,
      notes: r.notes,
      createdAt: new Date(r.createdAt),
      updatedAt: updated(r.id, r.createdAt),
    })),
    purchaseOrders: ds.purchaseOrders.map((p) => ({
      id: p.id,
      orderNumber: p.orderNumber,
      supplierId: id("supplier", p.supplierCode),
      destinationWarehouseId: p.destinationWarehouseCode === null ? null : id("warehouse", p.destinationWarehouseCode),
      createdById: user("procurement"),
      status: p.status,
      currency: p.currency,
      orderDate: date(p.orderDate),
      expectedArrivalDate: date(p.expectedArrivalDate),
      notes: p.notes,
      createdAt: new Date(p.createdAt),
      updatedAt: updated(p.id, p.createdAt),
    })),
    purchaseOrderItems: ds.purchaseOrders.flatMap((p) =>
      p.items.map((i) => ({
        id: i.id,
        purchaseOrderId: p.id,
        productId: id("product", i.productSku),
        quantityKg: kg(i.quantityKg),
        pricePerKg: i.pricePerKg === null ? null : decimal(i.pricePerKg),
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.createdAt),
      })),
    ),
    payables: ds.payables.map((p) => ({
      id: p.id,
      supplierId: id("supplier", p.supplierCode),
      amount: decimal(p.amount),
      paidAmount: decimal(p.paidAmount),
      currency: p.currency,
      dueDate: new Date(p.dueDate),
      status: p.status,
      reference: p.reference,
      notes: p.notes,
      createdAt: new Date(p.createdAt),
      updatedAt: new Date(p.createdAt),
    })),
    auditLogs: ds.auditLogs.map((a) => ({
      id: a.id,
      actorId: user(a.actor),
      entityType: a.entityType,
      entityId: a.entityId,
      action: a.action,
      metadata: auditMetadata(a, master),
      createdAt: new Date(a.createdAt),
    })),
  };
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export type ApplyResult = { written: Record<string, number>; previous: PreviousValues; verification: VerificationResult };

/**
 * Writes the canonical dataset. Refuses before any database access unless the
 * dataset is the canonical one; refuses before the first write if the
 * preflight finds anything unexpected; everything happens in ONE transaction
 * that re-checks the preflight, writes, verifies the written data and rolls
 * back on any failure.
 */
export async function applyDemo100m(db: DemoDb, ds: DemoDataset, checksum: string): Promise<ApplyResult> {
  if (ds.seed !== CANONICAL.seed || ds.asOf !== CANONICAL.asOf || checksum !== CANONICAL.checksum) {
    throw new DemoApplyError("apply is allowed only for the canonical DEMO-100M-v1 dataset (seed, as-of and checksum must match)");
  }
  const outside = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    return preflight(tx, ds);
  }, READ_ONLY_TRANSACTION_OPTIONS);
  if (outside.alreadyApplied) throw new DemoAlreadyAppliedError();
  if (!outside.ok) throw new DemoApplyError(`preflight failed — nothing written:\n  ${outside.problems.join("\n  ")}`);

  return db.$transaction(async (tx) => {
    const pre = await preflight(tx, ds); // re-checked inside the writing transaction
    if (pre.alreadyApplied) throw new DemoAlreadyAppliedError();
    if (!pre.ok) throw new DemoApplyError(`preflight failed — nothing written:\n  ${pre.problems.join("\n  ")}`);
    const rows = buildRows(ds, pre.master);
    const written: Record<string, number> = {};
    const insert = async (table: keyof DemoDbTx, label: string, data: Row[]) => {
      let count = 0;
      for (const part of chunks(data)) count += (await (tx[table] as DemoDbTx["batch"]).createMany({ data: part })).count;
      if (count !== data.length) throw new DemoApplyError(`${label}: wrote ${count} of ${data.length}`);
      written[label] = count;
    };

    // Master fields (demo-only columns; code, name, status, responsible untouched).
    for (const c of ds.customerUpdates) {
      await tx.customer.update({
        where: { id: pre.master.customer.get(c.customerCode)! },
        data: {
          paymentTermDays: c.paymentTermDays,
          creditLimit: c.creditLimit === null ? null : decimal(c.creditLimit),
          lastPurchaseAt: date(c.lastPurchaseAt),
          lastContactAt: date(c.lastContactAt),
          nextActionAt: date(c.nextActionAt),
        },
      });
    }
    written.customerUpdates = ds.customerUpdates.length;
    for (const s of ds.supplierUpdates) {
      await tx.supplier.update({ where: { id: pre.master.supplier.get(s.supplierCode)! }, data: { paymentTermDays: s.paymentTermDays } });
    }
    written.supplierUpdates = ds.supplierUpdates.length;

    // Operational rows, parents before children.
    await insert("batch", "batches", rows.batches);
    await insert("salesOrder", "salesOrders", rows.salesOrders);
    await insert("salesOrderItem", "salesOrderItems", rows.salesOrderItems);
    await insert("stockMovement", "stockMovements", rows.movements);
    await insert("stockReservation", "stockReservations", rows.reservations);
    await insert("receivable", "receivables", rows.receivables);
    await insert("purchaseOrder", "purchaseOrders", rows.purchaseOrders);
    await insert("purchaseOrderItem", "purchaseOrderItems", rows.purchaseOrderItems);
    await insert("payable", "payables", rows.payables);
    await insert("auditLog", "auditLogs", rows.auditLogs);

    // Read everything back inside the same transaction; any mismatch rolls it all back.
    const verification = await verifyDemo100mApplied(tx, ds);
    if (!verification.ok) throw new DemoApplyError(`post-write verification failed — rolled back:\n  ${verification.problems.join("\n  ")}`);
    return { written, previous: pre.previous, verification };
  }, APPLY_TRANSACTION_OPTIONS);
}

// ---------------------------------------------------------------------------
// Verification (read only)
// ---------------------------------------------------------------------------

export type VerificationResult = { ok: boolean; problems: string[]; summary: Record<string, number> };

async function rowsByIds(tx: DemoDbTx, table: IdTable, ids: string[]) {
  const out: Row[] = [];
  for (const part of chunks(ids)) out.push(...(await tx[table].findMany({ where: { id: { in: part } } })));
  return out;
}

/**
 * Reads the demo rows back (by their deterministic ids) and compares them
 * with the canonical dataset: per-table counts, statuses, every money /
 * quantity total, stock, reservations, active orders, markers, and that the
 * master catalogue and customer ownership are untouched. Exact — the dataset
 * is deterministic, so no tolerance is needed.
 */
export async function verifyDemo100mApplied(tx: DemoDbTx, ds: DemoDataset): Promise<VerificationResult> {
  const expected = computeMetrics(ds);
  const problems: string[] = [];
  const summary: Record<string, number> = {};
  const expect = (label: string, actual: number, want: number) => {
    summary[label] = actual;
    if (actual !== want) problems.push(`${label}: ${actual}, expected ${want}`);
  };
  const ids = datasetIds(ds);
  const load = Object.fromEntries(
    await Promise.all((Object.keys(ids) as IdTable[]).map(async (table) => [table, await rowsByIds(tx, table, [...ids[table]])] as const)),
  ) as Record<IdTable, Row[]>;
  for (const table of Object.keys(ids) as IdTable[]) expect(`rows.${table}`, load[table].length, ids[table].length);

  const orders = load.salesOrder;
  const statusCount = (status: string) => orders.filter((o) => o.status === status).length;
  for (const status of ["SHIPPED", "DRAFT", "CONFIRMED", "PROCESSING", "READY", "CANCELLED", "COMPLETED"]) {
    expect(`orders.${status}`, statusCount(status), expected.statusCounts[status] ?? 0);
  }
  expect("orders.active", statusCount("CONFIRMED") + statusCount("PROCESSING") + statusCount("READY"), expected.activeOrders);

  // Revenue per currency within the same 12 Kyiv months.
  const window = new Set(expected.months.map((m) => m.key));
  const kyivKey = (d: unknown) => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit" }).formatToParts(new Date(d as string | Date));
    return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
  };
  const itemsByOrder = new Map<string, Row[]>();
  for (const item of load.salesOrderItem) {
    const list = itemsByOrder.get(String(item.salesOrderId)) ?? [];
    list.push(item);
    itemsByOrder.set(String(item.salesOrderId), list);
  }
  const revenue = { UAH: 0, EUR: 0 } as Record<string, number>;
  for (const o of orders) {
    if (o.status !== "SHIPPED" || !window.has(kyivKey(o.shippedAt))) continue;
    for (const item of itemsByOrder.get(String(o.id)) ?? []) revenue[String(o.currency)] += Math.round(Number(String(item.quantityKg)) * toMinor(item.pricePerKg));
  }
  expect("revenue.UAH", revenue.UAH, expected.uahRevenue);
  expect("revenue.EUR", revenue.EUR, expected.eurRevenue);

  const asOfMs = new Date(ds.asOf).getTime();
  const open = (r: Row) => (r.status === "PAID" || r.status === "CANCELLED" ? 0 : Math.max(0, toMinor(r.amount) - toMinor(r.paidAmount)));
  const sumOpen = (rows: Row[]) => rows.reduce((s, r) => s + open(r), 0);
  const recUah = load.receivable.filter((r) => r.currency === "UAH");
  expect("ar.openUAH", sumOpen(recUah), expected.openArUah);
  expect("ar.overdueUAH", sumOpen(recUah.filter((r) => new Date(r.dueDate as string).getTime() < asOfMs)), expected.overdueArUah);
  expect("ar.openEUR", sumOpen(load.receivable.filter((r) => r.currency === "EUR")), expected.openArEur);
  expect("ap.openUAH", sumOpen(load.payable.filter((p) => p.currency === "UAH")), expected.openApUah);
  expect("ap.openEUR", sumOpen(load.payable.filter((p) => p.currency === "EUR")), expected.openApEur);
  for (const status of ["PAID", "OPEN", "PARTIALLY_PAID"]) {
    expect(`receivables.${status}`, load.receivable.filter((r) => r.status === status).length, expected.receivableStatusCounts[status] ?? 0);
  }

  const kgSum = (rows: Row[]) => rows.reduce((s, r) => s + Number(String(r.quantityKg)), 0);
  expect("stock.receivedKg", kgSum(load.stockMovement.filter((m) => m.type === "RECEIPT")), expected.receivedKg);
  expect("stock.shippedKg", kgSum(load.stockMovement.filter((m) => m.type === "SHIPMENT")), expected.shippedKg);
  expect("stock.physicalKg", kgSum(load.stockMovement.filter((m) => m.type === "RECEIPT")) - kgSum(load.stockMovement.filter((m) => m.type === "SHIPMENT")), expected.physicalKg);
  expect("stock.reservedKg", kgSum(load.stockReservation.filter((r) => r.status === "ACTIVE")), expected.reservedKg);

  // Markers.
  const unmarked = (["salesOrder", "batch", "stockMovement", "stockReservation", "receivable", "payable", "purchaseOrder"] as const).reduce(
    (s, table) => s + load[table].filter((r) => !String(r.notes ?? "").includes(DEMO_MARKER)).length,
    0,
  );
  expect("markers.missing", unmarked + load.auditLog.filter((a) => (a.metadata as Row | null)?.demo !== "DEMO-100M" || (a.metadata as Row | null)?.demoVersion !== "v1").length, 0);

  // Master catalogue untouched.
  const [customers, suppliers, products, warehouses] = await Promise.all([
    tx.customer.findMany({ select: { id: true, code: true, responsibleId: true } }),
    tx.supplier.count(),
    tx.product.count(),
    tx.warehouse.count(),
  ]);
  expect("master.customers", customers.length, PRODUCTION_BASELINE.customers);
  expect("master.suppliers", suppliers, PRODUCTION_BASELINE.suppliers);
  expect("master.products", products, PRODUCTION_BASELINE.products);
  expect("master.warehouses", warehouses, PRODUCTION_BASELINE.warehouses);
  expect("master.catalogueCustomersMissing", CUSTOMERS.filter((c) => !customers.some((row) => row.code === c.code)).length, 0);
  // Every demo order's responsible equals its customer's (unchanged) responsible.
  const responsibleByCustomerId = new Map(customers.map((c) => [String(c.id), c.responsibleId]));
  const orderOwnerMismatch = orders.filter((o) => {
    const owner = responsibleByCustomerId.get(String(o.customerId));
    return owner === undefined || owner !== o.responsibleId;
  }).length;
  expect("orders.responsibleMismatch", orderOwnerMismatch, 0);

  return { ok: problems.length === 0, problems, summary };
}
