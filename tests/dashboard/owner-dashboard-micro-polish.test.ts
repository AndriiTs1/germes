import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/lib/generated/prisma/client";

type OrderRow = {
  status: string;
  currency: string;
  orderDate: Date;
  shippedAt: Date | null;
  items: { quantityKg: Prisma.Decimal; pricePerKg: Prisma.Decimal }[];
};
type FinanceRow = { amount: Prisma.Decimal; paidAmount: Prisma.Decimal; status: string; currency: string; dueDate: Date | null };
type OrderWhere = {
  status?: string | { in?: string[] };
  OR?: ({ shippedAt: { gte: Date } } | { shippedAt: null; orderDate: { gte: Date } })[];
};
type FinanceWhere = { status?: { notIn?: string[] }; dueDate?: { lt?: Date } };

const db = vi.hoisted(() => ({
  orders: [] as OrderRow[],
  receivables: [] as FinanceRow[],
  payables: [] as FinanceRow[],
  locale: "ru" as "ru" | "uk" | "en",
}));

function orderMatches(row: OrderRow, where: OrderWhere | undefined): boolean {
  const s = where?.status;
  if (typeof s === "string" && row.status !== s) return false;
  if (s && typeof s === "object" && s.in && !s.in.includes(row.status)) return false;
  if (where?.OR) {
    return where.OR.some((c) =>
      "orderDate" in c ? row.shippedAt === null && row.orderDate >= c.orderDate.gte : row.shippedAt !== null && row.shippedAt >= c.shippedAt.gte,
    );
  }
  return true;
}
function financeMatches(row: FinanceRow, where: FinanceWhere | undefined): boolean {
  if (where?.status?.notIn?.includes(row.status)) return false;
  if (where?.dueDate?.lt && !(row.dueDate !== null && row.dueDate < where.dueDate.lt)) return false;
  return true;
}

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    salesOrder: {
      findMany: async ({ where }: { where?: OrderWhere } = {}) => db.orders.filter((o) => orderMatches(o, where)),
      count: async ({ where }: { where?: OrderWhere } = {}) => db.orders.filter((o) => orderMatches(o, where)).length,
    },
    receivable: { findMany: async ({ where }: { where?: FinanceWhere } = {}) => db.receivables.filter((r) => financeMatches(r, where)) },
    payable: { findMany: async ({ where }: { where?: FinanceWhere } = {}) => db.payables.filter((r) => financeMatches(r, where)) },
  },
}));

// Home page dependencies: an authenticated OWNER, cookie-free locale, and the
// (async, data-fetching) dashboard sections replaced by static stubs.
vi.mock("@/lib/auth/require-user", () => ({
  requireUser: async () => ({ id: "u1", name: "Owner", email: "owner@example.test", isActive: true, roles: [{ role: { code: "OWNER" } }] }),
}));
vi.mock("@/lib/permissions/get-current-user-permissions", () => ({
  getPermissionCodesForUser: async () => ["dashboard.command_center.read"],
}));
vi.mock("@/lib/i18n/locale", () => ({ getCurrentLocale: async () => db.locale }));
vi.mock("@/components/dashboard/dashboard-kpis", () => ({ DashboardKpis: () => null }));
vi.mock("@/components/dashboard/analytics/dashboard-analytics", () => ({ DashboardAnalytics: () => null }));
vi.mock("@/components/dashboard/operations/dashboard-operations", () => ({ DashboardOperations: () => null }));

import Home from "@/app/page";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { NeedsAttention } from "@/components/dashboard/operations/needs-attention";
import { formatMoney } from "@/components/sales/format";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getAttentionItems } from "@/lib/services/dashboard/get-attention-items";
import { getCommandCenterKpis } from "@/lib/services/dashboard/get-command-center-kpis";

const NOW = new Date("2026-10-15T09:00:00.000Z");
const OCT = "2026-10-05T10:00:00.000Z";
const PAST = new Date("2026-10-01T00:00:00.000Z");
const d = (value: string) => new Prisma.Decimal(value);

const shipped = (amount: string, currency: string): OrderRow => ({
  status: "SHIPPED",
  currency,
  orderDate: new Date(OCT),
  shippedAt: new Date(OCT),
  items: [{ quantityKg: d("1"), pricePerKg: d(amount) }],
});
const fin = (amount: string, currency: string, dueDate: Date | null = null, status = "OPEN", paid = "0"): FinanceRow => ({
  amount: d(amount),
  paidAmount: d(paid),
  status,
  currency,
  dueDate,
});
const currencies = (rows: { currency: string }[]) => rows.map((r) => r.currency);

beforeEach(() => {
  db.orders = [];
  db.receivables = [];
  db.payables = [];
  db.locale = "ru";
});

describe("Command Center — no decorative period selector", () => {
  it.each([
    ["ru", "Этот месяц"],
    ["uk", "Цей місяць"],
    ["en", "This month"],
  ] as const)("1. %s: the Owner Dashboard renders no period selector", async (locale, label) => {
    db.locale = locale;
    expect(getDictionary(locale).commandCenter.periodThisMonth).toBe(label);
    const html = renderToStaticMarkup((await Home()) as ReactElement);
    expect(html).toContain(getDictionary(locale).commandCenter.title);
    expect(html).not.toContain(label);
    expect(html).not.toContain("lucide-calendar");
  });

  it("2. the shared shell still renders the control for any page that asks for it (default unchanged)", () => {
    const dictionary = getDictionary("ru");
    const shell = (showPeriodControl?: boolean) =>
      renderToStaticMarkup(
        DashboardShell({
          user: { name: "Owner", email: "owner@example.test", roles: [{ role: { code: "OWNER" } }] },
          permissionCodes: [],
          activePath: "/x",
          dictionary,
          showPeriodControl,
          children: null,
        }),
      );
    expect(shell()).toContain("Этот месяц");
    expect(shell(true)).toContain("Этот месяц");
    expect(shell(false)).not.toContain("Этот месяц");
  });
});

describe("Needs Attention — money items are formatted, values unchanged", () => {
  // The card calls getAttentionItems() with the real clock; pin it to NOW.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("7. the service still returns the exact per-currency Decimal totals", async () => {
    db.receivables = [fin("2611800", "UAH", PAST), fin("6100", "EUR", PAST)];
    db.payables = [fin("7512340.5", "UAH"), fin("45300", "EUR")];
    expect(await getAttentionItems(NOW)).toEqual([
      { kind: "overdueCustomerPayments", money: { amount: "6100", currency: "EUR" } },
      { kind: "overdueCustomerPayments", money: { amount: "2611800", currency: "UAH" } },
      { kind: "openSupplierPayables", money: { amount: "45300", currency: "EUR" } },
      { kind: "openSupplierPayables", money: { amount: "7512340.5", currency: "UAH" } },
    ]);
  });

  it.each(["ru", "uk", "en"] as const)("3–6. %s: overdue and payable amounts use the money formatter; UAH stays UAH, EUR stays EUR", async (locale) => {
    db.receivables = [fin("2611800", "UAH", PAST), fin("6100", "EUR", PAST)];
    db.payables = [fin("7512340", "UAH"), fin("45300", "EUR")];
    db.orders = [{ ...shipped("1", "UAH"), status: "CONFIRMED", shippedAt: null }];
    const html = renderToStaticMarkup(await NeedsAttention({ locale, dictionary: getDictionary(locale) }));
    for (const [amount, currency] of [["2611800", "UAH"], ["6100", "EUR"], ["7512340", "UAH"], ["45300", "EUR"]]) {
      expect(html).toContain(formatMoney(amount, currency, locale));
    }
    for (const raw of ["2611800 UAH", "7512340 UAH", "45300 EUR"]) expect(html).not.toContain(raw);
    // the count item is not money-formatted
    expect(html).not.toMatch(/1 (UAH|EUR)/);
  });
});

describe("Owner KPIs — primary sales currency first", () => {
  it("8–11 + 15. primary UAH: UAH first in revenue, AR, overdue and AP; amounts unchanged, never merged", async () => {
    db.orders = [shipped("1000", "UAH"), shipped("2000", "UAH"), shipped("500", "EUR")];
    db.receivables = [fin("12000000", "UAH", PAST), fin("18000", "EUR", PAST)];
    db.payables = [fin("45000", "EUR"), fin("7500000", "UAH")];
    const kpis = await getCommandCenterKpis(NOW);
    expect(kpis.revenue12m).toEqual([
      { currency: "UAH", amount: "3000" },
      { currency: "EUR", amount: "500" },
    ]);
    expect(kpis.receivables.outstanding).toEqual([
      { currency: "UAH", amount: "12000000" },
      { currency: "EUR", amount: "18000" },
    ]);
    expect(kpis.receivables.overdueOutstanding).toEqual([
      { currency: "UAH", amount: "12000000" },
      { currency: "EUR", amount: "18000" },
    ]);
    expect(kpis.payables.outstanding).toEqual([
      { currency: "UAH", amount: "7500000" },
      { currency: "EUR", amount: "45000" },
    ]);
  });

  it("12. primary EUR: EUR first", async () => {
    db.orders = [shipped("1", "EUR"), shipped("2", "EUR"), shipped("100", "UAH")];
    db.receivables = [fin("1000", "UAH"), fin("10", "EUR")];
    db.payables = [fin("900", "UAH"), fin("9", "EUR")];
    const kpis = await getCommandCenterKpis(NOW);
    expect(currencies(kpis.revenue12m)).toEqual(["EUR", "UAH"]);
    expect(currencies(kpis.receivables.outstanding)).toEqual(["EUR", "UAH"]);
    expect(currencies(kpis.payables.outstanding)).toEqual(["EUR", "UAH"]);
  });

  it("13. primary currency absent from a KPI → the rest in currency-code order", async () => {
    db.orders = [shipped("1", "UAH")];
    db.payables = [fin("5", "USD"), fin("9", "EUR"), fin("7", "PLN")];
    expect(currencies((await getCommandCenterKpis(NOW)).payables.outstanding)).toEqual(["EUR", "PLN", "USD"]);
  });

  it("primary first, then the remaining currencies still ASC", async () => {
    db.orders = [shipped("1", "UAH")];
    db.receivables = [fin("5", "USD"), fin("9", "EUR"), fin("7", "UAH")];
    expect(currencies((await getCommandCenterKpis(NOW)).receivables.outstanding)).toEqual(["UAH", "EUR", "USD"]);
  });

  it("14. no shipped revenue → fallback to currency-code order", async () => {
    db.orders = [{ ...shipped("1", "UAH"), status: "CONFIRMED", shippedAt: null }];
    db.receivables = [fin("1000", "UAH"), fin("10", "EUR")];
    db.payables = [fin("900", "UAH"), fin("9", "EUR")];
    const kpis = await getCommandCenterKpis(NOW);
    expect(kpis.revenue12m).toEqual([]);
    expect(currencies(kpis.receivables.outstanding)).toEqual(["EUR", "UAH"]);
    expect(currencies(kpis.payables.outstanding)).toEqual(["EUR", "UAH"]);
  });
});
