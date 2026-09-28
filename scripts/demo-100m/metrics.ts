import { productKind, STALE_CONTACT_DAYS, STALE_PURCHASE_DAYS } from "./config";
import { addMonths, DAY, kyivMonthOf, monthKey, type YearMonth } from "./lib";
import { PRODUCTS } from "./master-data";
import type { DemoDataset, Receivable } from "./types";

/*
 * Pure aggregates over a generated dataset — shared by validate() and
 * report() so the printed numbers are exactly the validated ones.
 */

export type MonthRow = { key: string; orders: number; uahMinor: number };

export type DatasetMetrics = {
  months: MonthRow[];
  uahRevenue: number;
  eurRevenue: number;
  trendPct: number;
  eurShippedMonthKeys: string[];
  statusCounts: Record<string, number>;
  shippedUah: number;
  shippedEur: number;
  activeOrders: number;
  openArUah: number;
  overdueArUah: number;
  overdueDocsUah: number;
  openArEur: number;
  openApUah: number;
  openApEur: number;
  receivableStatusCounts: Record<string, number>;
  payableStatusCounts: Record<string, Record<string, number>>;
  receivedKg: number;
  shippedKg: number;
  physicalKg: number;
  reservedKg: number;
  availableKg: number;
  managerShares: Record<string, number>;
  attentionCustomers: number;
  itemCount: number;
  itemsPerOrder: number;
  /** Weighted average UAH price per kg of shipped UAH lines, minor units (kopecks). */
  avgPriceUah: number;
  /** Same, per product group (offal and fat reported together). */
  avgPriceByGroup: Record<"chicken" | "pork" | "beef" | "offal/fat", number>;
};

const open = (r: { amount: number; paidAmount: number; status: string }) =>
  r.status === "PAID" || r.status === "CANCELLED" ? 0 : Math.max(0, r.amount - r.paidAmount);

export function computeMetrics(ds: DemoDataset): DatasetMetrics {
  const asOf = new Date(ds.asOf);
  const asOfMs = asOf.getTime();
  const current = kyivMonthOf(asOf);
  const window: YearMonth[] = Array.from({ length: 12 }, (_, i) => addMonths(current, i - 11));
  const rowByKey = new Map(window.map((m) => [monthKey(m), { key: monthKey(m), orders: 0, uahMinor: 0 } as MonthRow]));

  const statusCounts: Record<string, number> = {};
  let uahRevenue = 0;
  let eurRevenue = 0;
  let shippedUah = 0;
  let shippedEur = 0;
  const eurMonths = new Set<string>();
  const managerRevenue: Record<string, number> = {};
  let itemCount = 0;
  for (const o of ds.salesOrders) {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
    itemCount += o.items.length;
    if (o.status !== "SHIPPED" && o.status !== "COMPLETED") continue;
    const amount = o.items.reduce((s, it) => s + it.quantityKg * it.pricePerKg, 0);
    const key = monthKey(kyivMonthOf(new Date(o.shippedAt!)));
    const row = rowByKey.get(key);
    if (o.currency === "UAH") {
      shippedUah += 1;
      if (row) {
        row.orders += 1;
        row.uahMinor += amount;
        uahRevenue += amount;
        managerRevenue[o.responsible] = (managerRevenue[o.responsible] ?? 0) + amount;
      }
    } else {
      shippedEur += 1;
      eurMonths.add(key);
      if (row) eurRevenue += amount;
    }
  }
  const months = window.map((m) => rowByKey.get(monthKey(m))!);
  const previous = months[10].uahMinor;
  const trendPct = previous > 0 ? ((months[11].uahMinor - previous) / previous) * 100 : 0;

  const sumOpen = (rows: Receivable[]) => rows.reduce((s, r) => s + open(r), 0);
  const uahRec = ds.receivables.filter((r) => r.currency === "UAH");
  const overdueUah = uahRec.filter((r) => new Date(r.dueDate).getTime() < asOfMs && open(r) > 0);
  const receivableStatusCounts: Record<string, number> = {};
  for (const r of ds.receivables) receivableStatusCounts[r.status] = (receivableStatusCounts[r.status] ?? 0) + 1;
  const payableStatusCounts: Record<string, Record<string, number>> = {};
  for (const p of ds.payables) {
    payableStatusCounts[p.currency] ??= {};
    payableStatusCounts[p.currency][p.status] = (payableStatusCounts[p.currency][p.status] ?? 0) + 1;
  }

  const receivedKg = ds.movements.filter((m) => m.type === "RECEIPT").reduce((s, m) => s + m.quantityKg, 0);
  const shippedKg = ds.movements.filter((m) => m.type === "SHIPMENT").reduce((s, m) => s + m.quantityKg, 0);
  const reservedKg = ds.reservations.filter((r) => r.status === "ACTIVE").reduce((s, r) => s + r.quantityKg, 0);

  const groupOf = new Map(
    PRODUCTS.map((p) => {
      const kind = productKind(p.name, p.category);
      return [p.sku, kind === "offal" || kind === "fat" ? "offal/fat" : kind] as const;
    }),
  );
  const priceAcc = new Map<string, { amount: number; kg: number }>();
  for (const o of ds.salesOrders) {
    if (o.status !== "SHIPPED" || o.currency !== "UAH") continue;
    for (const it of o.items) {
      for (const key of ["all", groupOf.get(it.productSku)!]) {
        const acc = priceAcc.get(key) ?? { amount: 0, kg: 0 };
        acc.amount += it.quantityKg * it.pricePerKg;
        acc.kg += it.quantityKg;
        priceAcc.set(key, acc);
      }
    }
  }
  const avg = (key: string) => {
    const acc = priceAcc.get(key);
    return acc && acc.kg > 0 ? Math.round(acc.amount / acc.kg) : 0;
  };

  const totalManager = Object.values(managerRevenue).reduce((s, v) => s + v, 0);
  const managerShares = Object.fromEntries(
    Object.entries(managerRevenue)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => [k, totalManager ? v / totalManager : 0]),
  );

  // Same rules as lib/services/sales/attention-rules.ts, counted per unique customer.
  const staleContactBefore = asOfMs - STALE_CONTACT_DAYS * DAY;
  const stalePurchaseBefore = asOfMs - STALE_PURCHASE_DAYS * DAY;
  const attentionCustomers = ds.customerUpdates.filter((c) => {
    const t = (v: string | null) => (v === null ? null : new Date(v).getTime());
    const next = t(c.nextActionAt);
    const contact = t(c.lastContactAt);
    const purchase = t(c.lastPurchaseAt);
    return (
      (next !== null && next <= asOfMs) ||
      (contact !== null && contact < staleContactBefore) ||
      (purchase !== null && purchase < stalePurchaseBefore)
    );
  }).length;

  return {
    months,
    uahRevenue,
    eurRevenue,
    trendPct,
    eurShippedMonthKeys: [...eurMonths].sort(),
    statusCounts,
    shippedUah,
    shippedEur,
    activeOrders: ["CONFIRMED", "PROCESSING", "READY"].reduce((s, k) => s + (statusCounts[k] ?? 0), 0),
    openArUah: sumOpen(uahRec),
    overdueArUah: sumOpen(overdueUah),
    overdueDocsUah: overdueUah.length,
    openArEur: sumOpen(ds.receivables.filter((r) => r.currency === "EUR")),
    openApUah: ds.payables.filter((p) => p.currency === "UAH").reduce((s, p) => s + open(p), 0),
    openApEur: ds.payables.filter((p) => p.currency === "EUR").reduce((s, p) => s + open(p), 0),
    receivableStatusCounts,
    payableStatusCounts,
    receivedKg,
    shippedKg,
    physicalKg: receivedKg - shippedKg,
    reservedKg,
    availableKg: receivedKg - shippedKg - reservedKg,
    managerShares,
    attentionCustomers,
    itemCount,
    itemsPerOrder: ds.salesOrders.length ? itemCount / ds.salesOrders.length : 0,
    avgPriceUah: avg("all"),
    avgPriceByGroup: { chicken: avg("chicken"), pork: avg("pork"), beef: avg("beef"), "offal/fat": avg("offal/fat") },
  };
}
