import type { Delegate, DemoDb, DemoDbTx, Row } from "../../scripts/demo-100m/db-types";
import { CUSTOMERS, PRODUCTS, SUPPLIERS, USER_ACCOUNTS, WAREHOUSE_CODES } from "../../scripts/demo-100m/master-data";

/*
 * In-memory stand-in for the Prisma client used by the apply phase: where
 * filters (equality / in / contains), createMany with foreign-key checks,
 * update, READ ONLY transactions and all-or-nothing rollback. No database.
 */

type TableName =
  | "customer" | "supplier" | "product" | "warehouse" | "user" | "salesOrder" | "salesOrderItem" | "batch" | "stockMovement"
  | "stockReservation" | "receivable" | "payable" | "purchaseOrder" | "purchaseOrderItem" | "auditLog";

const FOREIGN_KEYS: Partial<Record<TableName, [string, TableName][]>> = {
  salesOrder: [["customerId", "customer"], ["responsibleId", "user"]],
  salesOrderItem: [["salesOrderId", "salesOrder"], ["productId", "product"]],
  batch: [["productId", "product"]],
  stockMovement: [["batchId", "batch"], ["fromWarehouseId", "warehouse"], ["toWarehouseId", "warehouse"]],
  stockReservation: [["productId", "product"], ["batchId", "batch"], ["warehouseId", "warehouse"], ["salesOrderId", "salesOrder"], ["salesOrderItemId", "salesOrderItem"]],
  receivable: [["customerId", "customer"], ["salesOrderId", "salesOrder"]],
  payable: [["supplierId", "supplier"]],
  purchaseOrder: [["supplierId", "supplier"], ["destinationWarehouseId", "warehouse"], ["createdById", "user"]],
  purchaseOrderItem: [["purchaseOrderId", "purchaseOrder"], ["productId", "product"]],
  auditLog: [["actorId", "user"]],
};

/** Compiles a where filter once per call (`in` lists become Sets). */
function compile(where: Row | undefined): (row: Row) => boolean {
  if (!where) return () => true;
  const tests = Object.entries(where).map(([key, condition]): ((row: Row) => boolean) => {
    if (condition !== null && typeof condition === "object" && !(condition instanceof Date)) {
      const c = condition as { in?: unknown[]; contains?: string };
      if (c.in) {
        const set = new Set(c.in);
        return (row) => set.has(row[key]);
      }
      if (c.contains !== undefined) return (row) => typeof row[key] === "string" && (row[key] as string).includes(c.contains!);
    }
    return (row) => row[key] === condition;
  });
  return (row) => tests.every((t) => t(row));
}

export class FakeDb implements DemoDb {
  tables: Record<TableName, Row[]>;
  /** Number of write operations (createMany + update) that reached the store. */
  writes = 0;
  /** Throw when createMany hits this table (to prove rollback). */
  failOnTable: TableName | null = null;
  private readOnly = false;

  customer: Delegate; supplier: Delegate; product: Delegate; warehouse: Delegate; user: Delegate;
  salesOrder: Delegate; salesOrderItem: Delegate; batch: Delegate; stockMovement: Delegate; stockReservation: Delegate;
  receivable: Delegate; payable: Delegate; purchaseOrder: Delegate; purchaseOrderItem: Delegate; auditLog: Delegate;

  constructor() {
    this.tables = {
      customer: [], supplier: [], product: [], warehouse: [], user: [], salesOrder: [], salesOrderItem: [], batch: [],
      stockMovement: [], stockReservation: [], receivable: [], payable: [], purchaseOrder: [], purchaseOrderItem: [], auditLog: [],
    };
    this.customer = this.delegate("customer"); this.supplier = this.delegate("supplier"); this.product = this.delegate("product");
    this.warehouse = this.delegate("warehouse"); this.user = this.delegate("user"); this.salesOrder = this.delegate("salesOrder");
    this.salesOrderItem = this.delegate("salesOrderItem"); this.batch = this.delegate("batch"); this.stockMovement = this.delegate("stockMovement");
    this.stockReservation = this.delegate("stockReservation"); this.receivable = this.delegate("receivable"); this.payable = this.delegate("payable");
    this.purchaseOrder = this.delegate("purchaseOrder"); this.purchaseOrderItem = this.delegate("purchaseOrderItem"); this.auditLog = this.delegate("auditLog");
  }

  private delegate(name: TableName): Delegate {
    return {
      findMany: async (args) => this.tables[name].filter(compile(args?.where)).map((r) => ({ ...r })),
      count: async (args) => this.tables[name].filter(compile(args?.where)).length,
      createMany: async ({ data }) => {
        this.assertWritable();
        if (this.failOnTable === name) throw new Error(`injected failure on ${name}`);
        const ids = new Set(this.tables[name].map((r) => r.id));
        const targetIds = new Map((FOREIGN_KEYS[name] ?? []).map(([, target]) => [target, new Set(this.tables[target].map((t) => t.id))]));
        for (const row of data) {
          if (ids.has(row.id)) throw new Error(`duplicate id in ${name}`);
          for (const [field, target] of FOREIGN_KEYS[name] ?? []) {
            const ref = row[field];
            if (ref !== null && ref !== undefined && !targetIds.get(target)!.has(ref)) throw new Error(`FK ${name}.${field} → ${target} missing`);
          }
          ids.add(row.id);
        }
        this.writes += 1;
        this.tables[name].push(...data.map((r) => ({ ...r })));
        return { count: data.length };
      },
      update: async ({ where, data }) => {
        this.assertWritable();
        const row = this.tables[name].find(compile(where));
        if (!row) throw new Error(`update: no ${name} row`);
        this.writes += 1;
        Object.assign(row, data);
        return { ...row };
      },
    };
  }

  private assertWritable() {
    if (this.readOnly) throw new Error("write attempted in a READ ONLY transaction");
  }

  async $executeRawUnsafe(sql: string) {
    if (/SET TRANSACTION READ ONLY/i.test(sql)) this.readOnly = true;
    return 0;
  }

  async $transaction<T>(fn: (tx: DemoDbTx) => Promise<T>): Promise<T> {
    const snapshot = Object.fromEntries(Object.entries(this.tables).map(([k, rows]) => [k, rows.map((r) => ({ ...r }))])) as Record<TableName, Row[]>;
    try {
      return await fn(this);
    } catch (error) {
      this.tables = snapshot; // all-or-nothing
      throw error;
    } finally {
      this.readOnly = false;
    }
  }

  /** Stable copy of every table (for before/after comparisons). */
  dump(): Record<string, Row[]> {
    return JSON.parse(JSON.stringify(this.tables));
  }
}

/** A database in the production baseline state: master data only, 40 old audit rows, PO-2026-001 cancelled. */
export function productionBaseline(): FakeDb {
  const db = new FakeDb();
  const userId = (key: string) => `user-${key}`;
  const accounts = Object.entries(USER_ACCOUNTS).map(([key, a]) => ({
    id: userId(key),
    email: a.email,
    isActive: true,
    roles: [{ role: { code: a.role } }],
  }));
  db.tables.user = [
    ...accounts,
    { id: "user-owner", email: "owner@example.test", isActive: true, roles: [{ role: { code: "OWNER" } }] },
    { id: "user-admin", email: "admin@example.test", isActive: true, roles: [{ role: { code: "ADMIN" } }] },
    { id: "user-support", email: "support@example.test", isActive: true, roles: [{ role: { code: "SUPPORT" } }] },
  ];
  db.tables.customer = CUSTOMERS.map((c, i) => ({
    id: `customer-${i}`,
    code: c.code,
    name: c.name,
    status: "ACTIVE",
    responsibleId: userId(c.responsible),
    paymentTermDays: 0,
    creditLimit: null,
    lastPurchaseAt: null,
    lastContactAt: null,
    nextActionAt: null,
  }));
  db.tables.supplier = SUPPLIERS.map((s, i) => ({ id: `supplier-${i}`, code: s.code, name: s.name, status: "ACTIVE", paymentTermDays: 0 }));
  db.tables.product = PRODUCTS.map((p, i) => ({ id: `product-${i}`, sku: p.sku, name: p.name, isActive: true }));
  db.tables.warehouse = WAREHOUSE_CODES.map((code, i) => ({ id: `warehouse-${i}`, code, isActive: true }));
  db.tables.purchaseOrder = [{ id: "po-old", orderNumber: "PO-2026-001", status: "CANCELLED", supplierId: "supplier-0", createdById: userId("procurement"), notes: null }];
  db.tables.purchaseOrderItem = [{ id: "po-old-item", purchaseOrderId: "po-old", productId: "product-0" }];
  db.tables.auditLog = Array.from({ length: 40 }, (_, i) => ({ id: `old-audit-${i}`, actorId: null, entityType: "SalesOrder", entityId: `gone-${i}`, action: "CREATE", metadata: {} }));
  return db;
}
