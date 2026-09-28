import {
  CANCELLED_WITH_RELEASED_RESERVATIONS,
  CONFIRMED_COVERAGE,
  DEMO_MARKER,
  PAYABLE_STATUS_TARGETS,
  PRICE_BAND_EUR,
  PRICE_BANDS_UAH,
  PRICE_TOLERANCE,
  productKind,
  RANGES,
  RECEIVABLE_STATUS_TARGETS,
  STATUS_COUNTS,
  TOTAL_SALES_ORDERS,
} from "./config";
import { PRODUCTS } from "./master-data";
import { sha256, UUID_PATTERN } from "./lib";
import { computeMetrics, type DatasetMetrics } from "./metrics";
import type { DemoDataset, SalesOrder, StockReservation } from "./types";

export type CheckResult = { id: number; name: string; pass: boolean; detail: string };
export type ValidationResult = { checks: CheckResult[]; passed: number; failed: CheckResult[]; metrics: DatasetMetrics };

export function datasetChecksum(ds: DemoDataset): string {
  return sha256(JSON.stringify(ds));
}

const within = (v: number, [lo, hi]: readonly [number, number]) => v >= lo && v <= hi;
const ms = (v: string) => new Date(v).getTime();

/**
 * Pure in-memory validation of every DEMO 100M invariant. `regenerate`
 * rebuilds the dataset from the same seed + as-of to prove determinism
 * (always the last check).
 */
export function validateDataset(ds: DemoDataset, regenerate: () => DemoDataset): ValidationResult {
  const m = computeMetrics(ds);
  const asOfMs = ms(ds.asOf);
  const checks: CheckResult[] = [];
  const check = (name: string, pass: boolean, detail = "") => checks.push({ id: checks.length + 1, name, pass, detail });

  const orders = ds.salesOrders;
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const shipped = orders.filter((o) => o.status === "SHIPPED");
  const receivablesByOrder = new Map<string, number>();
  for (const r of ds.receivables) receivablesByOrder.set(r.salesOrderId, (receivablesByOrder.get(r.salesOrderId) ?? 0) + 1);
  const reservationsByOrder = new Map<string, StockReservation[]>();
  for (const r of ds.reservations) {
    const list = reservationsByOrder.get(r.salesOrderId) ?? [];
    list.push(r);
    reservationsByOrder.set(r.salesOrderId, list);
  }
  const shipmentsByRef = new Map<string, number>();
  for (const mv of ds.movements) if (mv.type === "SHIPMENT") shipmentsByRef.set(mv.reference, (shipmentsByRef.get(mv.reference) ?? 0) + mv.quantityKg);
  const orderQty = (o: SalesOrder) => o.items.reduce((s, it) => s + it.quantityKg, 0);
  const orderAmount = (o: SalesOrder) => o.items.reduce((s, it) => s + it.quantityKg * it.pricePerKg, 0);
  const coverage = (o: SalesOrder) => {
    const active = (reservationsByOrder.get(o.id) ?? []).filter((r) => r.status === "ACTIVE").reduce((s, r) => s + r.quantityKg, 0);
    return active / orderQty(o);
  };
  const itemCoverageExact = (o: SalesOrder, status: StockReservation["status"]) =>
    o.items.every(
      (it) =>
        (reservationsByOrder.get(o.id) ?? [])
          .filter((r) => r.salesOrderItemId === it.id && r.status === status)
          .reduce((s, r) => s + r.quantityKg, 0) === it.quantityKg,
    );
  const sc = m.statusCounts;

  // 1–5 counts
  check("SalesOrder total = 1184", orders.length === TOTAL_SALES_ORDERS, String(orders.length));
  check(
    "status counts exact",
    sc.DRAFT === STATUS_COUNTS.DRAFT &&
      sc.CONFIRMED === STATUS_COUNTS.CONFIRMED &&
      sc.PROCESSING === STATUS_COUNTS.PROCESSING &&
      sc.READY === STATUS_COUNTS.READY &&
      sc.CANCELLED === STATUS_COUNTS.CANCELLED &&
      (sc.COMPLETED ?? 0) === 0,
    JSON.stringify(sc),
  );
  check("SHIPPED = 1092", shipped.length === STATUS_COUNTS.SHIPPED_UAH + STATUS_COUNTS.SHIPPED_EUR, String(shipped.length));
  check("UAH SHIPPED = 1080", m.shippedUah === STATUS_COUNTS.SHIPPED_UAH, String(m.shippedUah));
  check("EUR SHIPPED = 12", m.shippedEur === STATUS_COUNTS.SHIPPED_EUR, String(m.shippedEur));

  // 6–12 receivables & dates
  check("every SHIPPED has exactly 1 Receivable", shipped.every((o) => receivablesByOrder.get(o.id) === 1));
  check("no non-SHIPPED has a Receivable", orders.filter((o) => o.status !== "SHIPPED").every((o) => !receivablesByOrder.has(o.id)));
  check("Receivable amount = Σ item totals", ds.receivables.every((r) => r.amount === orderAmount(orderById.get(r.salesOrderId)!)));
  check(
    "Receivable currency / customer / reference match the order",
    ds.receivables.every((r) => {
      const o = orderById.get(r.salesOrderId)!;
      return r.currency === o.currency && r.customerCode === o.customerCode && r.reference === o.orderNumber && r.createdAt === o.shippedAt;
    }),
  );
  check(
    "paidAmount bounds / status consistency",
    ds.receivables.every((r) => {
      if (r.status === "PAID") return r.paidAmount === r.amount;
      if (r.status === "OPEN") return r.paidAmount === 0;
      if (r.status === "PARTIALLY_PAID") return r.paidAmount >= r.amount * 0.3 - 1 && r.paidAmount <= r.amount * 0.7 + 1;
      return false;
    }),
  );
  check("orderDate <= shippedAt <= asOf", shipped.every((o) => ms(o.orderDate) <= ms(o.shippedAt!) && ms(o.shippedAt!) <= asOfMs));
  {
    const recById = new Map(ds.receivables.map((r) => [r.id, r]));
    check(
      "every payment is after shippedAt and <= asOf",
      ds.paymentEvents.every((p) => ms(p.at) > ms(recById.get(p.receivableId)!.createdAt) && ms(p.at) <= asOfMs),
    );
  }

  // 13–17 reservations & shipments of shipped / non-shipped orders
  check("all SHIPPED reservations CONSUMED", shipped.every((o) => (reservationsByOrder.get(o.id) ?? []).every((r) => r.status === "CONSUMED")));
  check("no ACTIVE reservation on SHIPPED", !ds.reservations.some((r) => r.status === "ACTIVE" && orderById.get(r.salesOrderId)!.status === "SHIPPED"));
  check("CONSUMED qty per item = item qty", shipped.every((o) => itemCoverageExact(o, "CONSUMED")));
  check("SHIPMENT qty per order = Σ item qty", shipped.every((o) => shipmentsByRef.get(o.orderNumber) === orderQty(o)));
  check(
    "DRAFT/CANCELLED: no shipment, no consumed reservation",
    orders
      .filter((o) => o.status === "DRAFT" || o.status === "CANCELLED")
      .every((o) => !shipmentsByRef.has(o.orderNumber) && !(reservationsByOrder.get(o.id) ?? []).some((r) => r.status === "CONSUMED" || r.status === "ACTIVE")),
  );

  // 18–21 active orders
  {
    const confirmed = orders.filter((o) => o.status === "CONFIRMED").map(coverage);
    const full = confirmed.filter((c) => c === 1).length;
    const none = confirmed.filter((c) => c === 0).length;
    const partial = confirmed.filter((c) => c > 0 && c < 1).length;
    check("CONFIRMED coverage 10 full / 5 partial / 5 none", full === CONFIRMED_COVERAGE.full && partial === CONFIRMED_COVERAGE.partial && none === CONFIRMED_COVERAGE.none, `${full}/${partial}/${none}`);
  }
  check(
    "CONFIRMED ACTIVE reservations expire after asOf",
    ds.reservations.filter((r) => r.status === "ACTIVE" && orderById.get(r.salesOrderId)!.status === "CONFIRMED").every((r) => ms(r.expiresAt) > asOfMs),
  );
  check("PROCESSING coverage = 100%", orders.filter((o) => o.status === "PROCESSING").every((o) => itemCoverageExact(o, "ACTIVE")));
  check("READY coverage = 100%", orders.filter((o) => o.status === "READY").every((o) => itemCoverageExact(o, "ACTIVE")));

  // 22–25 stock
  const batchById = new Map(ds.batches.map((b) => [b.id, b]));
  const finalStock = new Map<string, number>();
  let chronologicalOk = true;
  {
    const running = new Map<string, number>();
    const sorted = [...ds.movements].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || (a.type === "RECEIPT" ? -1 : 1) - (b.type === "RECEIPT" ? -1 : 1));
    for (const mv of sorted) {
      const wh = mv.type === "RECEIPT" ? mv.toWarehouseCode : mv.fromWarehouseCode;
      const key = `${mv.batchId}|${wh}`;
      const next = (running.get(key) ?? 0) + (mv.type === "RECEIPT" ? mv.quantityKg : -mv.quantityKg);
      if (next < 0) chronologicalOk = false;
      running.set(key, next);
    }
    for (const [k, v] of running) finalStock.set(k, v);
  }
  check("remaining stock per batch/warehouse >= 0", [...finalStock.values()].every((v) => v >= 0));
  check("stock never negative chronologically", chronologicalOk);
  {
    const reservedByKey = new Map<string, number>();
    for (const r of ds.reservations) if (r.status === "ACTIVE") reservedByKey.set(`${r.batchId}|${r.warehouseCode}`, (reservedByKey.get(`${r.batchId}|${r.warehouseCode}`) ?? 0) + r.quantityKg);
    check("ACTIVE reservations <= current stock", [...reservedByKey].every(([k, v]) => v <= (finalStock.get(k) ?? 0)));
  }
  {
    const receipts = new Map<string, number>();
    for (const mv of ds.movements) if (mv.type === "RECEIPT") receipts.set(mv.batchId, (receipts.get(mv.batchId) ?? 0) + mv.quantityKg);
    check("receivedKg = Σ RECEIPT per batch", ds.batches.every((b) => receipts.get(b.id) === b.receivedKg));
  }

  // 26–36 metric ranges
  check("physical stock 92–98 t", within(m.physicalKg, RANGES.physicalKg), `${m.physicalKg} kg`);
  check("active reserved 32–36 t", within(m.reservedKg, RANGES.reservedKg), `${m.reservedKg} kg`);
  check("UAH revenue 99–102M", within(m.uahRevenue, RANGES.uahRevenue), `${m.uahRevenue / 100}`);
  check("current/previous month trend +5…+8%", within(m.trendPct, RANGES.trendPct), m.trendPct.toFixed(2));
  check("EUR revenue 135–145k", within(m.eurRevenue, RANGES.eurRevenueCents), `${m.eurRevenue / 100}`);
  {
    const lastTwo = [m.months[10].key, m.months[11].key];
    check("no EUR shipped in the last two months", !m.eurShippedMonthKeys.some((k) => lastTwo.includes(k)), m.eurShippedMonthKeys.join(","));
  }
  check("open AR UAH 11.5–12.5M", within(m.openArUah, RANGES.openArUah), `${m.openArUah / 100}`);
  check("overdue AR UAH 2.4–2.8M (25–35 docs)", within(m.overdueArUah, RANGES.overdueArUah) && within(m.overdueDocsUah, RANGES.overdueDocs), `${m.overdueArUah / 100} / ${m.overdueDocsUah}`);
  check("open AR EUR 17–19k", within(m.openArEur, RANGES.openArEurCents), `${m.openArEur / 100}`);
  check("open AP UAH 7.0–8.0M", within(m.openApUah, RANGES.openApUah), `${m.openApUah / 100}`);
  check("open AP EUR 42–48k", within(m.openApEur, RANGES.openApEurCents), `${m.openApEur / 100}`);

  // 37–39 operations
  check("active orders = 44", m.activeOrders === 44, String(m.activeOrders));
  check("customer attention unique count = 13", m.attentionCustomers === 13, String(m.attentionCustomers));
  check("each SALES manager 25–40% of UAH revenue", Object.values(m.managerShares).length === 3 && Object.values(m.managerShares).every((s) => within(s, RANGES.managerShare)), JSON.stringify(m.managerShares));

  // 40–43 hygiene
  {
    const forbidden =
      orders.some((o) => o.status === "COMPLETED") ||
      ds.receivables.some((r) => r.status === "OVERDUE" || r.status === "CANCELLED") ||
      ds.payables.some((p) => p.status === "OVERDUE") ||
      ds.purchaseOrders.some((p) => p.status === "CLOSED") ||
      ds.batches.some((b) => b.status !== "AVAILABLE") ||
      ds.movements.some((mv) => mv.type !== "RECEIPT" && mv.type !== "SHIPMENT") ||
      orders.filter((o) => o.status === "CANCELLED").filter((o) => (reservationsByOrder.get(o.id) ?? []).length > 0).length !== CANCELLED_WITH_RELEASED_RESERVATIONS;
    check("no prohibited statuses / movement types (+ batch count, expiry bounds)", !forbidden);
  }
  {
    const ids = [
      ...orders.map((o) => o.id),
      ...orders.flatMap((o) => o.items.map((i) => i.id)),
      ...ds.reservations.map((r) => r.id),
      ...ds.batches.map((b) => b.id),
      ...ds.movements.map((mv) => mv.id),
      ...ds.receivables.map((r) => r.id),
      ...ds.purchaseOrders.map((p) => p.id),
      ...ds.purchaseOrders.flatMap((p) => p.items.map((i) => i.id)),
      ...ds.payables.map((p) => p.id),
      ...ds.auditLogs.map((a) => a.id),
    ];
    check("all generated UUIDs valid and unique", new Set(ids).size === ids.length && ids.every((id) => UUID_PATTERN.test(id)), `${ids.length} ids`);
  }
  {
    const numbers = [...orders.map((o) => o.orderNumber), ...ds.purchaseOrders.map((p) => p.orderNumber)];
    check(
      "all order numbers unique (PO-2026-001 reserved)",
      new Set(numbers).size === numbers.length && !numbers.includes("PO-2026-001") && ds.batches.length === new Set(ds.batches.map((b) => `${b.productSku}|${b.batchNumber}`)).size,
    );
  }
  check(
    "every demo entity carries the marker",
    orders.every((o) => o.notes.includes(DEMO_MARKER)) &&
      ds.reservations.every((r) => r.notes.includes(DEMO_MARKER)) &&
      ds.batches.every((b) => b.notes.includes(DEMO_MARKER)) &&
      ds.movements.every((mv) => mv.notes.includes(DEMO_MARKER)) &&
      ds.receivables.every((r) => r.notes.includes(DEMO_MARKER)) &&
      ds.purchaseOrders.every((p) => p.notes.includes(DEMO_MARKER)) &&
      ds.payables.every((p) => p.notes.includes(DEMO_MARKER)) &&
      ds.auditLogs.every((a) => a.metadata.demo === "DEMO-100M" && a.metadata.demoVersion === "v1"),
  );

  // 44–50 volumes, statuses and price realism
  check("items per order 2.4–2.6 (1–5 lines each)", within(m.itemsPerOrder, RANGES.itemsPerOrder) && orders.every((o) => o.items.length >= 1 && o.items.length <= 5), m.itemsPerOrder.toFixed(3));
  check(
    "Receivable statuses exactly 960 PAID / 88 OPEN / 44 PARTIALLY_PAID",
    m.receivableStatusCounts.PAID === RECEIVABLE_STATUS_TARGETS.PAID &&
      m.receivableStatusCounts.OPEN === RECEIVABLE_STATUS_TARGETS.OPEN &&
      m.receivableStatusCounts.PARTIALLY_PAID === RECEIVABLE_STATUS_TARGETS.PARTIALLY_PAID,
    JSON.stringify(m.receivableStatusCounts),
  );
  {
    const matches = (currency: "UAH" | "EUR") => {
      const got = m.payableStatusCounts[currency] ?? {};
      const want = PAYABLE_STATUS_TARGETS[currency];
      return got.PAID === want.PAID && got.PARTIALLY_PAID === want.PARTIALLY_PAID && got.OPEN === want.OPEN && Object.keys(got).length === 3;
    };
    check("Payables exactly 130 = UAH 92/9/17 + EUR 8/1/3 (no CANCELLED)", ds.payables.length === 130 && matches("UAH") && matches("EUR"), JSON.stringify(m.payableStatusCounts));
  }
  check(
    "Payable paidAmount bounds / status consistency",
    ds.payables.every((p) =>
      p.status === "PAID" ? p.paidAmount === p.amount : p.status === "OPEN" ? p.paidAmount === 0 : p.status === "PARTIALLY_PAID" && p.paidAmount >= p.amount * 0.3 - 1 && p.paidAmount <= p.amount * 0.7 + 1,
    ),
  );
  check("AuditLog 13k–16k lifecycle events", within(ds.auditLogs.length, RANGES.auditLogs), String(ds.auditLogs.length));
  check("payment events 1 100–1 250 (PAID 1–2, PARTIAL 1, OPEN 0)", within(ds.paymentEvents.length, RANGES.paymentEvents) && paymentsPerStatusOk(), String(ds.paymentEvents.length));
  {
    const kindBySku = new Map(PRODUCTS.map((p) => [p.sku, productKind(p.name, p.category)]));
    const bad = orders.flatMap((o) =>
      o.items.filter((it) => {
        const perKg = it.pricePerKg / 100;
        const [lo, hi] = o.currency === "EUR" ? PRICE_BAND_EUR : PRICE_BANDS_UAH[kindBySku.get(it.productSku)!];
        return perKg < lo * PRICE_TOLERANCE.low || perKg > hi * PRICE_TOLERANCE.high;
      }),
    );
    check("every line price inside its category band (±8 % client, ±3 % year)", bad.length === 0, `${bad.length} outside`);
  }

  // Last: determinism
  check("same seed + asOf → same checksum", datasetChecksum(regenerate()) === datasetChecksum(ds));

  // Sanity bounds folded into the hygiene check: batch count and expiry of stocked batches.
  const extra: string[] = [];
  if (!within(ds.batches.length, RANGES.batches)) extra.push(`batches ${ds.batches.length} outside ${RANGES.batches.join("–")}`);
  if (ds.batches.some((b) => batchStockAfter(b.id) > 0 && ms(b.expiryDate) <= asOfMs + 60 * 86_400_000)) extra.push("a batch with stock expires within 60 days");
  if (extra.length) checks[39] = { ...checks[39], pass: false, detail: `${checks[39].detail} ${extra.join("; ")}`.trim() };

  const failed = checks.filter((c) => !c.pass);
  return { checks, passed: checks.length - failed.length, failed, metrics: m };

  function paymentsPerStatusOk() {
    const count = new Map<string, number>();
    const total = new Map<string, number>();
    for (const p of ds.paymentEvents) {
      count.set(p.receivableId, (count.get(p.receivableId) ?? 0) + 1);
      total.set(p.receivableId, (total.get(p.receivableId) ?? 0) + p.amount);
    }
    return ds.receivables.every((r) => {
      const n = count.get(r.id) ?? 0;
      const sum = total.get(r.id) ?? 0;
      if (r.status === "PAID") return (n === 1 || n === 2) && sum === r.amount;
      if (r.status === "PARTIALLY_PAID") return n === 1 && sum === r.paidAmount;
      return n === 0;
    });
  }

  function batchStockAfter(batchId: string) {
    const b = batchById.get(batchId)!;
    return finalStock.get(`${batchId}|${b.warehouseCode}`) ?? 0;
  }
}
