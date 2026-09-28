import { getAttentionItems } from "../../lib/services/dashboard/get-attention-items";
import { getCommandCenterKpis } from "../../lib/services/dashboard/get-command-center-kpis";
import { getInventoryStatus } from "../../lib/services/dashboard/get-inventory-status";
import { getPaymentCalendar } from "../../lib/services/dashboard/get-payment-calendar";
import { getRecentOrders } from "../../lib/services/dashboard/get-recent-orders";
import { getSalesPerformance } from "../../lib/services/dashboard/get-sales-performance";
import { listWarehouseOrders } from "../../lib/services/warehouse/list-warehouse-orders";
import { minorToDecimal } from "./lib";
import { computeMetrics } from "./metrics";
import type { DemoDataset } from "./types";

/*
 * Post-apply checks through the application's REAL read services (unchanged),
 * against the database configured in DATABASE_URL. Read only. Run with
 * `scripts/demo-seed.ts --verify` after an apply; never used by --dry-run.
 */

export type ServiceCheck = { name: string; pass: boolean; detail: string };

const minor = (decimalString: string) => {
  const [whole, frac = ""] = decimalString.replace("-", "").split(".");
  const value = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return decimalString.startsWith("-") ? -value : value;
};
const byCurrency = (rows: { currency: string; amount: string }[]) => Object.fromEntries(rows.map((r) => [r.currency, minor(r.amount)]));

export async function verifyThroughServices(ds: DemoDataset): Promise<ServiceCheck[]> {
  const m = computeMetrics(ds);
  const asOf = new Date(ds.asOf);
  const checks: ServiceCheck[] = [];
  const check = (name: string, pass: boolean, detail: unknown) => checks.push({ name, pass, detail: typeof detail === "string" ? detail : JSON.stringify(detail) });
  const eurOverdue = ds.receivables
    .filter((r) => r.currency === "EUR" && r.status !== "PAID" && new Date(r.dueDate).getTime() < asOf.getTime())
    .reduce((s, r) => s + r.amount - r.paidAmount, 0);

  const kpis = await getCommandCenterKpis(asOf);
  check("KPI revenue 12m per currency", JSON.stringify(byCurrency(kpis.revenue12m)) === JSON.stringify({ UAH: m.uahRevenue, EUR: m.eurRevenue }), kpis.revenue12m);
  check("KPI receivables per currency", JSON.stringify(byCurrency(kpis.receivables.outstanding)) === JSON.stringify({ UAH: m.openArUah, EUR: m.openArEur }), kpis.receivables.outstanding);
  check("KPI overdue receivables UAH", byCurrency(kpis.receivables.overdueOutstanding).UAH === m.overdueArUah, kpis.receivables.overdueOutstanding);
  check("KPI payables per currency", JSON.stringify(byCurrency(kpis.payables.outstanding)) === JSON.stringify({ UAH: m.openApUah, EUR: m.openApEur }), kpis.payables.outstanding);
  check("KPI active orders = 44", kpis.activeOrders.count === m.activeOrders, String(kpis.activeOrders.count));

  const perf = await getSalesPerformance(asOf);
  const perfTotals = Object.fromEntries(perf.series.map((s) => [s.currency, minor(s.total)]));
  check("Sales Performance totals", perfTotals.UAH === m.uahRevenue && perfTotals.EUR === m.eurRevenue, perfTotals);
  check("Sales Performance trend is UAH, up", perf.trend?.currency === "UAH" && perf.trend.direction === "up", perf.trend);

  const calendar = await getPaymentCalendar(asOf);
  check("Payment Calendar has 5 dated events", calendar.length === 5 && calendar.every((e, i) => i === 0 || calendar[i - 1].dueDate <= e.dueDate), calendar.map((e) => `${e.dueDate.slice(0, 10)} ${e.amount} ${e.currency}`).join("; "));

  const inventory = await getInventoryStatus();
  const reservedPct = Math.round((m.reservedKg / m.physicalKg) * 100);
  check(
    "Inventory Status physical / reserved",
    inventory.value === String(Math.round(m.physicalKg)) && inventory.segments.find((s) => s.key === "reserved")?.pct === reservedPct,
    inventory,
  );

  const recent = await getRecentOrders();
  const numbers = new Set(ds.salesOrders.map((o) => o.orderNumber));
  check("Recent Orders are demo orders", recent.length === 5 && recent.every((o) => numbers.has(o.orderNumber)), recent.map((o) => `${o.orderNumber} ${o.status}`).join(", "));

  const attention = await getAttentionItems(asOf);
  const money = (kind: string, currency: string) => attention.find((a) => a.kind === kind && a.money?.currency === currency)?.money?.amount;
  check(
    "Needs Attention overdue / payables / confirmed",
    money("overdueCustomerPayments", "UAH") === minorToDecimal(m.overdueArUah) &&
      money("overdueCustomerPayments", "EUR") === minorToDecimal(eurOverdue) &&
      money("openSupplierPayables", "UAH") === minorToDecimal(m.openApUah) &&
      money("openSupplierPayables", "EUR") === minorToDecimal(m.openApEur) &&
      attention.find((a) => a.kind === "confirmedOrdersAwaitingProcessing")?.count === m.statusCounts.CONFIRMED,
    attention,
  );

  const queue = await listWarehouseOrders();
  check("Warehouse queue = 44 active orders", queue.length === m.activeOrders, String(queue.length));

  return checks;
}
