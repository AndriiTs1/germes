import { DATASET_VERSION } from "./config";
import { DAY, minorToDecimal } from "./lib";
import type { DatasetMetrics } from "./metrics";
import type { DemoDataset, SalesOrder } from "./types";
import type { ValidationResult } from "./validate";

/*
 * Plain-text dry-run report: aggregates and eight showcase records only —
 * never entity dumps, emails or other personal data.
 */

const money = (minor: number, currency: string) => `${Number(minorToDecimal(minor)).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;
const kg = (v: number) => `${v.toLocaleString("en-US")} kg`;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const pad = (s: string, n: number) => s.padEnd(n);

export type Showcase = { title: string; reference: string; customerCode: string; status: string; amount: string; why: string };

export function pickShowcases(ds: DemoDataset): Showcase[] {
  const asOfMs = new Date(ds.asOf).getTime();
  const orderAmount = (o: SalesOrder) => o.items.reduce((s, it) => s + it.quantityKg * it.pricePerKg, 0);
  const recByOrder = new Map(ds.receivables.map((r) => [r.salesOrderId, r]));
  const active = (o: SalesOrder) =>
    ds.reservations.filter((r) => r.salesOrderId === o.id && r.status === "ACTIVE").reduce((s, r) => s + r.quantityKg, 0);
  const qty = (o: SalesOrder) => o.items.reduce((s, it) => s + it.quantityKg, 0);
  const byNumber = (a: SalesOrder, b: SalesOrder) => (a.orderNumber < b.orderNumber ? -1 : 1);
  const row = (title: string, o: SalesOrder | undefined, why: string, status?: string): Showcase =>
    o
      ? { title, reference: o.orderNumber, customerCode: o.customerCode, status: status ?? o.status, amount: money(orderAmount(o), o.currency), why }
      : { title, reference: "—", customerCode: "—", status: "—", amount: "—", why: "not found" };

  const shipped = ds.salesOrders.filter((o) => o.status === "SHIPPED");
  const largePaid = [...shipped]
    .filter((o) => o.currency === "UAH" && recByOrder.get(o.id)?.status === "PAID")
    .sort((a, b) => Math.abs(orderAmount(a) - 40_000_000) - Math.abs(orderAmount(b) - 40_000_000) || byNumber(a, b))[0];
  // 150–250k UAH, 40–60 % paid, due date passed — a meaningful open remainder.
  const partialOverdue = [...shipped]
    .filter((o) => {
      const r = recByOrder.get(o.id);
      return (
        o.currency === "UAH" &&
        r?.status === "PARTIALLY_PAID" &&
        new Date(r.dueDate).getTime() < asOfMs &&
        r.amount >= 15_000_000 &&
        r.amount <= 25_000_000 &&
        r.paidAmount >= r.amount * 0.4 &&
        r.paidAmount <= r.amount * 0.6
      );
    })
    .sort(byNumber)[0];
  const partialRec = partialOverdue ? recByOrder.get(partialOverdue.id)! : undefined;
  const confirmed = ds.salesOrders.filter((o) => o.status === "CONFIRMED").sort(byNumber);
  const fullConfirmed = confirmed.find((o) => active(o) === qty(o));
  const partialConfirmed = confirmed.find((o) => active(o) > 0 && active(o) < qty(o));
  const processingExpired = ds.salesOrders
    .filter((o) => o.status === "PROCESSING")
    .sort(byNumber)
    .find((o) => ds.reservations.some((r) => r.salesOrderId === o.id && r.status === "ACTIVE" && new Date(r.expiresAt).getTime() < asOfMs));
  const ready = ds.salesOrders.filter((o) => o.status === "READY").sort(byNumber)[0];
  const eurOpen = shipped.filter((o) => o.currency === "EUR" && recByOrder.get(o.id)?.status !== "PAID").sort(byNumber)[0];
  const attention = ds.customerUpdates
    .filter((c) => c.attentionGroup === "nextActionOverdue")
    .sort((a, b) => (a.customerCode < b.customerCode ? -1 : 1))[0];
  const attentionOrder = shipped.filter((o) => o.customerCode === attention?.customerCode).sort(byNumber).at(-1);

  return [
    row("Large PAID UAH order", largePaid, "closest to 400k UAH, fully paid"),
    row(
      "PARTIALLY_PAID overdue UAH",
      partialOverdue,
      partialRec
        ? `paid ${money(partialRec.paidAmount, "UAH")} (${pct(partialRec.paidAmount / partialRec.amount)}), open ${money(partialRec.amount - partialRec.paidAmount, "UAH")}, ${Math.round((asOfMs - new Date(partialRec.dueDate).getTime()) / DAY)} d overdue`
        : "—",
      "SHIPPED / PARTIALLY_PAID",
    ),
    row("CONFIRMED, fully reserved", fullConfirmed, "ready to start processing"),
    row("CONFIRMED, partially reserved", partialConfirmed, `${partialConfirmed ? pct(active(partialConfirmed) / qty(partialConfirmed)) : "—"} reserved`),
    row("PROCESSING, reservation past expiresAt", processingExpired, "TTL no longer applies after acceptance"),
    row("READY to ship", ready, "fully reserved, awaiting shipment"),
    row("EUR receivable", eurOpen, `open balance in EUR (${recByOrder.get(eurOpen?.id ?? "")?.status ?? "—"})`),
    row(
      "Customer requiring attention",
      attentionOrder,
      attention ? `next action overdue by ${Math.round((asOfMs - new Date(attention.nextActionAt!).getTime()) / DAY)} d` : "—",
      attention ? "customer" : undefined,
    ),
  ];
}

export function renderReport(ds: DemoDataset, result: ValidationResult, checksum: string, runtimeMs: number): string {
  const m: DatasetMetrics = result.metrics;
  const lines: string[] = [];
  const out = (s = "") => lines.push(s);
  const pass = result.failed.length === 0;

  out(`DEMO 100M DRY RUN: ${pass ? "PASS" : "FAIL"}`);
  out();
  out(`Dataset version  ${DATASET_VERSION}`);
  out(`Seed             ${ds.seed}`);
  out(`As-of            ${ds.asOf}`);
  out(`Timezone         ${ds.timeZone}`);
  out();
  out("ENTITY COUNTS");
  const uniq = (xs: string[]) => new Set(xs).size;
  const counts: [string, number][] = [
    ["Customers referenced", uniq(ds.customerUpdates.map((c) => c.customerCode))],
    ["Suppliers referenced", uniq([...ds.batches.map((b) => b.supplierCode), ...ds.purchaseOrders.map((p) => p.supplierCode)])],
    ["Products referenced", uniq(ds.salesOrders.flatMap((o) => o.items.map((i) => i.productSku)))],
    ["Warehouses referenced", uniq(ds.batches.map((b) => b.warehouseCode))],
    ["SalesOrders", ds.salesOrders.length],
    ["SalesOrder items", m.itemCount],
    ["Items per order (avg)", Number(m.itemsPerOrder.toFixed(3))],
    ["Reservations", ds.reservations.length],
    ["Batches", ds.batches.length],
    ["Receipts", ds.movements.filter((mv) => mv.type === "RECEIPT").length],
    ["Shipments", ds.movements.filter((mv) => mv.type === "SHIPMENT").length],
    ["Receivables", ds.receivables.length],
    ["Payment events", ds.paymentEvents.length],
    ["Purchase orders", ds.purchaseOrders.length],
    ["Payables", ds.payables.length],
    ["Audit logs", ds.auditLogs.length],
  ];
  for (const [k, v] of counts) out(`  ${pad(k, 24)}${v.toLocaleString("en-US")}`);
  out();
  out("SALES STATUS TABLE");
  const sc = m.statusCounts;
  for (const [k, v] of [
    ["SHIPPED UAH", m.shippedUah],
    ["SHIPPED EUR", m.shippedEur],
    ["DRAFT", sc.DRAFT ?? 0],
    ["CONFIRMED", sc.CONFIRMED ?? 0],
    ["PROCESSING", sc.PROCESSING ?? 0],
    ["READY", sc.READY ?? 0],
    ["CANCELLED", sc.CANCELLED ?? 0],
    ["COMPLETED", sc.COMPLETED ?? 0],
  ] as const)
    out(`  ${pad(k, 24)}${v}`);
  out();
  out("MONTHLY SALES TABLE (shipped UAH, Europe/Kyiv)");
  out(`  ${pad("month", 10)}${pad("orders", 8)}${pad("UAH revenue", 20)}% annual`);
  for (const row of m.months) out(`  ${pad(row.key, 10)}${pad(String(row.orders), 8)}${pad(money(row.uahMinor, "UAH"), 20)}${pct(row.uahMinor / m.uahRevenue)}`);
  out(`  current vs previous month: ${m.trendPct >= 0 ? "+" : ""}${m.trendPct.toFixed(2)}%`);
  out();
  out("FINANCIAL METRICS");
  out(`  UAH revenue (12m)       ${money(m.uahRevenue, "UAH")}`);
  out(`  EUR revenue (12m)       ${money(m.eurRevenue, "EUR")}`);
  out(`  AR UAH (open)           ${money(m.openArUah, "UAH")}`);
  out(`  overdue AR UAH          ${money(m.overdueArUah, "UAH")} (${m.overdueDocsUah} docs)`);
  out(`  AR EUR (open)           ${money(m.openArEur, "EUR")}`);
  out(`  AP UAH (open)           ${money(m.openApUah, "UAH")}`);
  out(`  AP EUR (open)           ${money(m.openApEur, "EUR")}`);
  const statuses = (c: Record<string, number> = {}) => ["PAID", "OPEN", "PARTIALLY_PAID"].map((k) => `${k} ${c[k] ?? 0}`).join(" / ");
  out(`  Receivable statuses     ${statuses(m.receivableStatusCounts)}`);
  out(`  Payable statuses UAH    ${statuses(m.payableStatusCounts.UAH)}`);
  out(`  Payable statuses EUR    ${statuses(m.payableStatusCounts.EUR)}`);
  out(`  Payment events          ${ds.paymentEvents.length}`);
  {
    const open = ds.payables.filter((p) => p.currency === "UAH" && p.status !== "PAID").map((p) => p.amount - p.paidAmount);
    const band = (lo: number, hi: number) => open.filter((v) => v >= lo * 100 && v < hi * 100).length;
    out(`  Open AP UAH by document  <100k ${band(0, 100_000)} · 100–250k ${band(100_000, 250_000)} · 250–500k ${band(250_000, 500_000)} · 500–900k ${band(500_000, 900_000)} · ≥900k ${band(900_000, Infinity)}`);
  }
  out();
  out("WAREHOUSE METRICS");
  out(`  received                ${kg(m.receivedKg)}`);
  out(`  shipped                 ${kg(m.shippedKg)}`);
  out(`  physical                ${kg(m.physicalKg)}`);
  out(`  reserved (ACTIVE)       ${kg(m.reservedKg)}`);
  out(`  available               ${kg(m.availableKg)}`);
  out();
  out("PRICES (shipped UAH lines, weighted by kg)");
  out(`  all products            ${money(m.avgPriceUah, "UAH")}/kg`);
  out(`  ${Object.entries(m.avgPriceByGroup).map(([k, v]) => `${k} ${money(v, "UAH")}/kg`).join(" · ")}`);
  out();
  out("OPERATIONS");
  out(`  active orders           ${m.activeOrders}`);
  out(`  customer attention      ${m.attentionCustomers}`);
  out(`  manager revenue shares  ${Object.entries(m.managerShares).map(([k, v]) => `${k} ${pct(v)}`).join(", ")}`);
  out();
  out("SHOWCASE SCENARIOS");
  pickShowcases(ds).forEach((s, i) => out(`  ${i + 1}. ${pad(s.title, 42)}${pad(s.reference, 14)}${pad(s.customerCode, 10)}${pad(s.status, 26)}${pad(s.amount, 18)}${s.why}`));
  out();
  out("VALIDATION");
  out(`  ${result.passed}/${result.checks.length} PASS`);
  for (const c of result.failed) out(`  FAIL #${c.id} ${c.name} — ${c.detail}`);
  out();
  out("SERVICE CHECKS");
  out("  DEFERRED TO STAGING APPLY PHASE");
  out();
  out(`CHECKSUM (SHA-256)  ${checksum}`);
  out(`Runtime             ${runtimeMs} ms`);
  return lines.join("\n");
}
