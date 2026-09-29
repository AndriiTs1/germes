import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/lib/generated/prisma/client";

type OrderRow = {
  status: string;
  currency: string;
  orderDate: Date;
  shippedAt: Date | null;
  items: { quantityKg: Prisma.Decimal; pricePerKg: Prisma.Decimal }[];
};
type FinanceRow = { amount: Prisma.Decimal; paidAmount: Prisma.Decimal; status: string; currency: string; dueDate: Date | null };
type Where = {
  status?: { in?: string[] };
  OR?: ({ shippedAt: { gte: Date } } | { shippedAt: null; orderDate: { gte: Date } })[];
};

const db = vi.hoisted(() => ({ orders: [] as OrderRow[], receivables: [] as FinanceRow[], payables: [] as FinanceRow[] }));

/** Applies the where shapes of getSalesPerformance (status IN + date OR) and the active-orders count (status IN). */
function applyWhere(rows: OrderRow[], where: Where | undefined): OrderRow[] {
  return rows.filter((row) => {
    if (where?.status?.in && !where.status.in.includes(row.status)) return false;
    if (where?.OR) {
      return where.OR.some((c) =>
        "orderDate" in c
          ? row.shippedAt === null && row.orderDate >= c.orderDate.gte
          : row.shippedAt !== null && row.shippedAt >= c.shippedAt.gte,
      );
    }
    return true;
  });
}

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    salesOrder: {
      findMany: async ({ where }: { where?: Where } = {}) => applyWhere(db.orders, where),
      count: async ({ where }: { where?: Where } = {}) => applyWhere(db.orders, where).length,
    },
    receivable: { findMany: async () => db.receivables },
    payable: { findMany: async () => db.payables },
  },
}));

import { getCommandCenterKpis } from "@/lib/services/dashboard/get-command-center-kpis";
import { getSalesPerformance } from "@/lib/services/dashboard/get-sales-performance";

const NOW = new Date("2026-10-15T09:00:00.000Z"); // Kyiv window: Nov 2025 … Oct 2026
const d = (value: string) => new Prisma.Decimal(value);

function order(status: string, amount: string, at: string, currency = "UAH", opts: { orderDate?: string } = {}): OrderRow {
  const shipped = status === "SHIPPED" || status === "COMPLETED";
  return {
    status,
    currency,
    orderDate: new Date(opts.orderDate ?? at),
    shippedAt: shipped ? new Date(at) : null,
    items: [{ quantityKg: d("1"), pricePerKg: d(amount) }],
  };
}
const revenue = async () => (await getCommandCenterKpis(NOW)).revenue12m;
const active = async () => (await getCommandCenterKpis(NOW)).activeOrders.count;
const OCT = "2026-10-05T10:00:00.000Z";

beforeEach(() => {
  db.orders = [];
  db.receivables = [];
  db.payables = [];
});

describe("KPI Revenue — last 12 months (same rule as Sales Performance)", () => {
  it.each(["DRAFT", "CONFIRMED", "PROCESSING", "READY", "CANCELLED"])("6–10. %s is excluded", async (status) => {
    db.orders = [order(status, "500", OCT)];
    expect(await revenue()).toEqual([]);
  });

  it.each(["SHIPPED", "COMPLETED"])("11–12. %s is included", async (status) => {
    db.orders = [order(status, "500", OCT)];
    expect(await revenue()).toEqual([{ currency: "UAH", amount: "500" }]);
  });

  it("13. shippedAt, not orderDate, decides the window", async () => {
    db.orders = [
      // ordered before the window, shipped inside it → counted
      order("SHIPPED", "100", "2025-11-03T10:00:00.000Z", "UAH", { orderDate: "2025-10-28T10:00:00.000Z" }),
      // ordered inside, shipped after "now" → outside the window
      order("SHIPPED", "900", "2026-11-02T10:00:00.000Z", "UAH", { orderDate: "2026-10-10T10:00:00.000Z" }),
    ];
    expect(await revenue()).toEqual([{ currency: "UAH", amount: "100" }]);
  });

  it("14 + 15. exactly 12 Kyiv calendar months, previous year before current year; older shipments excluded", async () => {
    db.orders = [
      order("SHIPPED", "1", "2025-10-20T10:00:00.000Z"), // 12 months back → out
      order("SHIPPED", "10", "2025-11-20T10:00:00.000Z"),
      order("SHIPPED", "20", "2026-01-20T10:00:00.000Z"),
      order("SHIPPED", "30", OCT),
    ];
    expect(await revenue()).toEqual([{ currency: "UAH", amount: "60" }]);
    const { months } = await getSalesPerformance(NOW);
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ year: 2025, month: 11 });
    expect(months[11]).toEqual({ year: 2026, month: 10 });
  });

  it("16. Kyiv boundary: 31 Oct 2025 22:30 UTC is already 1 Nov in Kyiv → inside the window", async () => {
    db.orders = [order("SHIPPED", "7", "2025-10-31T22:30:00.000Z"), order("SHIPPED", "3", "2025-10-31T21:30:00.000Z")];
    // 22:30 UTC = 00:30 Kyiv (UTC+2) on 1 Nov → in; 21:30 UTC = 23:30 Kyiv 31 Oct → out
    expect(await revenue()).toEqual([{ currency: "UAH", amount: "7" }]);
  });

  it("17. UAH and EUR stay separate (never summed)", async () => {
    db.orders = [order("SHIPPED", "1000", OCT, "UAH"), order("SHIPPED", "100", OCT, "EUR")];
    expect(await revenue()).toEqual([
      { currency: "EUR", amount: "100" },
      { currency: "UAH", amount: "1000" },
    ]);
  });

  it("18. Decimal totals are exact", async () => {
    db.orders = [
      { ...order("SHIPPED", "0", OCT), items: [{ quantityKg: d("12.345"), pricePerKg: d("99.99") }, { quantityKg: d("0.1"), pricePerKg: d("0.2") }] },
      order("SHIPPED", "0.1", OCT),
    ];
    // 12.345 × 99.99 = 1234.37655; + 0.02 + 0.1 = 1234.49655
    expect(await revenue()).toEqual([{ currency: "UAH", amount: "1234.49655" }]);
  });

  it("headline currency = most shipped orders (as in Sales Performance), ties by code", async () => {
    db.orders = [order("SHIPPED", "5", OCT, "EUR"), order("SHIPPED", "1000", OCT, "UAH"), order("SHIPPED", "2000", OCT, "UAH")];
    expect((await revenue()).map((r) => r.currency)).toEqual(["UAH", "EUR"]);
  });

  it("the KPI equals Sales Performance totals exactly (one formula)", async () => {
    db.orders = [order("SHIPPED", "10", OCT), order("COMPLETED", "20", "2026-03-03T10:00:00.000Z", "EUR"), order("DRAFT", "99", OCT)];
    const { series } = await getSalesPerformance(NOW);
    const byCurrency = (rows: { currency: string; amount: string }[]) => Object.fromEntries(rows.map((r) => [r.currency, r.amount]));
    expect(byCurrency(await revenue())).toEqual(byCurrency(series.map(({ currency, total }) => ({ currency, amount: total }))));
  });
});

describe("KPI Active orders = CONFIRMED + PROCESSING + READY", () => {
  it.each([
    ["CONFIRMED", 1],
    ["PROCESSING", 1],
    ["READY", 1],
    ["DRAFT", 0],
    ["CANCELLED", 0],
    ["SHIPPED", 0],
    ["COMPLETED", 0],
  ] as const)("19–25. %s counts %i", async (status, expected) => {
    db.orders = [order(status, "1", OCT)];
    expect(await active()).toBe(expected);
  });

  it("mixed statuses → only the three working statuses are counted", async () => {
    db.orders = ["CONFIRMED", "CONFIRMED", "PROCESSING", "READY", "DRAFT", "CANCELLED", "SHIPPED", "COMPLETED"].map((s) =>
      order(s, "1", OCT),
    );
    expect(await active()).toBe(4);
  });
});

describe("KPI Active orders — breakdown by status", () => {
  const byStatus = async () => (await getCommandCenterKpis(NOW)).activeOrders;

  it("splits the active orders by real status, in pipeline order, and adds up to the headline", async () => {
    db.orders = [
      ...Array.from({ length: 20 }, () => order("CONFIRMED", "1", OCT)),
      ...Array.from({ length: 12 }, () => order("PROCESSING", "1", OCT)),
      ...Array.from({ length: 12 }, () => order("READY", "1", OCT)),
      ...["DRAFT", "SHIPPED", "COMPLETED", "CANCELLED"].map((s) => order(s, "1", OCT)),
    ];
    const kpi = await byStatus();
    expect(kpi.count).toBe(44);
    expect(kpi.byStatus).toEqual([
      { status: "CONFIRMED", count: 20 },
      { status: "PROCESSING", count: 12 },
      { status: "READY", count: 12 },
    ]);
    expect(kpi.byStatus.reduce((sum, entry) => sum + entry.count, 0)).toBe(kpi.count);
  });

  it("a status without orders is still listed with 0", async () => {
    db.orders = [order("READY", "1", OCT)];
    expect((await byStatus()).byStatus).toEqual([
      { status: "CONFIRMED", count: 0 },
      { status: "PROCESSING", count: 0 },
      { status: "READY", count: 1 },
    ]);
  });

  it("no active orders at all → total 0 and every status 0", async () => {
    db.orders = ["DRAFT", "SHIPPED", "CANCELLED"].map((s) => order(s, "1", OCT));
    const kpi = await byStatus();
    expect(kpi.count).toBe(0);
    expect(kpi.byStatus.map((entry) => entry.count)).toEqual([0, 0, 0]);
  });
});

describe("Finance KPIs unchanged", () => {
  const fin = (status: string, amount: string, paid: string, currency: string, dueDate: Date | null = null): FinanceRow => ({
    amount: d(amount),
    paidAmount: d(paid),
    status,
    currency,
    dueDate,
  });

  it("26–28. receivables, overdue and payables keep open balances per currency", async () => {
    const past = new Date("2026-10-01T00:00:00.000Z");
    db.receivables = [
      fin("PARTIALLY_PAID", "1000", "400", "UAH", past),
      fin("OPEN", "100", "0", "EUR"),
      fin("PAID", "500", "500", "UAH", past),
      fin("CANCELLED", "700", "0", "UAH", past),
    ];
    db.payables = [fin("OPEN", "300", "0", "EUR"), fin("CANCELLED", "900", "0", "UAH")];
    const kpis = await getCommandCenterKpis(NOW);
    expect(kpis.receivables.outstanding).toEqual([
      { currency: "EUR", amount: "100" },
      { currency: "UAH", amount: "600" },
    ]);
    expect(kpis.receivables.overdueOutstanding).toEqual([{ currency: "UAH", amount: "600" }]);
    expect(kpis.payables.outstanding).toEqual([{ currency: "EUR", amount: "300" }]);
  });
});
