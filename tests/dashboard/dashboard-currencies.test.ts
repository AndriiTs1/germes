import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/lib/generated/prisma/client";

type FinanceRow = {
  amount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  status: string;
  currency: string;
  dueDate: Date | null;
};

const db = vi.hoisted(() => ({
  orders: [] as { status: string; currency: string; orderDate: Date; shippedAt: Date | null; items: { quantityKg: unknown; pricePerKg: unknown }[] }[],
  receivables: [] as FinanceRow[],
  payables: [] as FinanceRow[],
  batchFindMany: vi.fn(async () => []),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    // Honours the status filter of getSalesPerformance (revenue) and the active-orders count.
    salesOrder: {
      findMany: async ({ where }: { where?: { status?: { in?: string[] } } } = {}) =>
        db.orders.filter((o) => !where?.status?.in || where.status.in.includes(o.status)),
      count: async ({ where }: { where?: { status?: { in?: string[] } } } = {}) =>
        db.orders.filter((o) => !where?.status?.in || where.status.in.includes(o.status)).length,
    },
    receivable: { findMany: async () => db.receivables },
    payable: { findMany: async () => db.payables },
    batch: { findMany: db.batchFindMany },
  },
}));

import { DashboardKpis } from "@/components/dashboard/dashboard-kpis";
import { formatMoney } from "@/components/sales/format";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCommandCenterKpis } from "@/lib/services/dashboard/get-command-center-kpis";

const NOW = new Date("2026-09-28T12:00:00.000Z");
const PAST = new Date("2026-09-20T00:00:00.000Z");
const d = (value: string) => new Prisma.Decimal(value);

function fin(status: string, amount: string, paid: string, currency: string, dueDate: Date | null = null): FinanceRow {
  return { amount: d(amount), paidAmount: d(paid), status, currency, dueDate };
}

/** An unshipped (CONFIRMED) order: counts as active, never as revenue. */
function order(currency: string) {
  return { status: "CONFIRMED", currency, orderDate: PAST, shippedAt: null, items: [{ quantityKg: d("1"), pricePerKg: d("1") }] };
}

async function renderKpis() {
  const element = await DashboardKpis({ locale: "en", dictionary: getDictionary("en") });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  db.orders = [];
  db.receivables = [];
  db.payables = [];
  db.batchFindMany.mockClear();
});

describe("getCommandCenterKpis — per-currency balances", () => {
  it("1. 1000 UAH + 100 EUR receivables stay two amounts, never 1100", async () => {
    db.receivables = [fin("OPEN", "1000", "0", "UAH"), fin("OPEN", "100", "0", "EUR")];
    expect((await getCommandCenterKpis(NOW)).receivables.outstanding).toEqual([
      { currency: "EUR", amount: "100" },
      { currency: "UAH", amount: "1000" },
    ]);
  });

  it("2. PARTIALLY_PAID 1000/400 UAH → 600 UAH", async () => {
    db.receivables = [fin("PARTIALLY_PAID", "1000", "400", "UAH")];
    expect((await getCommandCenterKpis(NOW)).receivables.outstanding).toEqual([{ currency: "UAH", amount: "600" }]);
  });

  it("3. PAID / CANCELLED are excluded (no zero entry for their currency)", async () => {
    db.receivables = [fin("PAID", "1000", "1000", "EUR"), fin("CANCELLED", "500", "0", "UAH")];
    expect((await getCommandCenterKpis(NOW)).receivables.outstanding).toEqual([]);
  });

  it("4. overdue 600 UAH + 100 EUR → two separate amounts", async () => {
    db.receivables = [fin("PARTIALLY_PAID", "1000", "400", "UAH", PAST), fin("OPEN", "100", "0", "EUR", PAST)];
    expect((await getCommandCenterKpis(NOW)).receivables.overdueOutstanding).toEqual([
      { currency: "EUR", amount: "100" },
      { currency: "UAH", amount: "600" },
    ]);
  });

  it("5. payables in several currencies → separate amounts", async () => {
    db.payables = [fin("OPEN", "800", "0", "UAH"), fin("PARTIALLY_PAID", "300", "100", "EUR"), fin("OPEN", "50", "0", "EUR")];
    expect((await getCommandCenterKpis(NOW)).payables.outstanding).toEqual([
      { currency: "EUR", amount: "250" },
      { currency: "UAH", amount: "800" },
    ]);
  });

  it("9. currency order is deterministic (by code), whatever the row order", async () => {
    db.receivables = [fin("OPEN", "1", "0", "UAH"), fin("OPEN", "2", "0", "EUR"), fin("OPEN", "3", "0", "USD")];
    const first = (await getCommandCenterKpis(NOW)).receivables.outstanding.map((row) => row.currency);
    db.receivables = [...db.receivables].reverse();
    const second = (await getCommandCenterKpis(NOW)).receivables.outstanding.map((row) => row.currency);
    expect(first).toEqual(["EUR", "UAH", "USD"]);
    expect(second).toEqual(first);
  });
});

describe("Owner Dashboard KPI cards — currency labels", () => {
  it("6. a last sales order in EUR does not relabel a UAH receivable", async () => {
    db.orders = [order("UAH"), order("EUR")];
    db.receivables = [fin("OPEN", "1000", "0", "UAH")];
    const html = await renderKpis();
    expect(html).toContain(formatMoney("1000", "UAH", "en"));
    expect(html).not.toContain(formatMoney("1000", "EUR", "en"));
  });

  it("7. a last sales order in UAH does not relabel an EUR receivable", async () => {
    db.orders = [order("EUR"), order("UAH")];
    db.receivables = [fin("OPEN", "100", "0", "EUR")];
    const html = await renderKpis();
    expect(html).toContain(formatMoney("100", "EUR", "en"));
    expect(html).not.toContain(formatMoney("100", "UAH", "en"));
  });

  it("8 + 12. no finance records → plain 0, no currency borrowed from the last EUR order", async () => {
    db.orders = [order("EUR")];
    const html = await renderKpis();
    expect(html).not.toContain("EUR");
    expect(html).not.toContain("UAH");
  });

  it("10. one currency renders one line", async () => {
    db.receivables = [fin("OPEN", "1000", "0", "UAH")];
    const html = await renderKpis();
    // desktop card + mobile row each render it exactly once
    expect(html.split(formatMoney("1000", "UAH", "en")).length - 1).toBe(2);
  });

  it("11. two currencies render as two lines and other KPIs are unaffected", async () => {
    db.receivables = [fin("OPEN", "1000", "0", "UAH"), fin("OPEN", "100", "0", "EUR")];
    const html = await renderKpis();
    const t = getDictionary("en").commandCenter.kpi;
    expect(html).toContain(formatMoney("1000", "UAH", "en"));
    expect(html).toContain(formatMoney("100", "EUR", "en"));
    expect(html).not.toContain(formatMoney("1100", "UAH", "en"));
    expect(html).not.toContain(formatMoney("1100", "EUR", "en"));
    for (const id of ["revenue12m", "receivables", "overdueAr", "payables", "activeOrders"] as const) {
      expect(html).toContain(t[id].replace(/&/g, "&amp;"));
    }
  });
});

describe("getCommandCenterKpis — no Inventory Value", () => {
  it("4 + 5. inventoryValue is not computed and Batch is never queried", async () => {
    db.receivables = [fin("OPEN", "1000", "0", "UAH")];
    const kpis = await getCommandCenterKpis(NOW);
    expect(kpis).not.toHaveProperty("inventoryValue");
    expect(db.batchFindMany).not.toHaveBeenCalled();
  });

  it("6 + 7. receivables / overdue / payables still work; no gross margin any more", async () => {
    db.receivables = [fin("PARTIALLY_PAID", "1000", "400", "UAH", PAST), fin("OPEN", "100", "0", "EUR")];
    db.payables = [fin("OPEN", "300", "0", "EUR")];
    const kpis = await getCommandCenterKpis(NOW);
    expect(kpis.receivables.outstanding).toEqual([
      { currency: "EUR", amount: "100" },
      { currency: "UAH", amount: "600" },
    ]);
    expect(kpis.receivables.overdueOutstanding).toEqual([{ currency: "UAH", amount: "600" }]);
    expect(kpis.payables.outstanding).toEqual([{ currency: "EUR", amount: "300" }]);
    expect(kpis).not.toHaveProperty("grossMargin");
    expect(kpis).not.toHaveProperty("cashBanks");
  });
});
