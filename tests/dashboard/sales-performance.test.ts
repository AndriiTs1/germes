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

type Where = {
  status?: { in?: string[] };
  OR?: ({ shippedAt: { gte: Date } } | { shippedAt: null; orderDate: { gte: Date } })[];
};

const db = vi.hoisted(() => ({ orders: [] as OrderRow[] }));

/** Applies the where shape getSalesPerformance uses, so the status/date filter itself is under test. */
function applyWhere(rows: OrderRow[], where: Where | undefined): OrderRow[] {
  return rows.filter((row) => {
    if (where?.status?.in && !where.status.in.includes(row.status)) return false;
    if (where?.OR) {
      return where.OR.some((condition) =>
        "orderDate" in condition
          ? row.shippedAt === null && row.orderDate >= condition.orderDate.gte
          : row.shippedAt !== null && row.shippedAt >= condition.shippedAt.gte,
      );
    }
    return true;
  });
}

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    salesOrder: { findMany: async ({ where }: { where?: Where } = {}) => applyWhere(db.orders, where) },
  },
}));

import { SalesPerformance } from "@/components/dashboard/analytics/sales-performance";
import { formatKg, formatMoney } from "@/components/sales/format";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getSalesPerformance, lastKyivMonths, monthKey } from "@/lib/services/dashboard/get-sales-performance";

const d = (value: string) => new Prisma.Decimal(value);

/** One order worth `amount` (1 kg × amount), shipped at `shippedAt`. */
function order(status: string, amount: string, shippedAt: string, currency = "UAH"): OrderRow {
  const at = new Date(shippedAt);
  return {
    status,
    currency,
    orderDate: at,
    shippedAt: status === "SHIPPED" || status === "COMPLETED" ? at : null,
    items: [{ quantityKg: d("1"), pricePerKg: d(amount) }],
  };
}

// Kyiv: 15 Oct 2026 → window Nov 2025 … Oct 2026; previous month = Sep 2026.
const NOW = new Date("2026-10-15T09:00:00.000Z");
const SEP = "2026-09-10T10:00:00.000Z";
const OCT = "2026-10-05T10:00:00.000Z";

const kpis = (now = NOW) => getSalesPerformance(now);

async function render(locale: "en" | "uk" | "ru" = "en") {
  const element = await SalesPerformance({ locale, dictionary: getDictionary(locale) });
  return renderToStaticMarkup(element);
}

function ariaSummary(html: string): string {
  return html.match(/role="img" aria-label="([^"]*)"/)?.[1] ?? "";
}

beforeEach(() => {
  db.orders = [];
});

describe("getSalesPerformance — which orders count", () => {
  it.each(["DRAFT", "CANCELLED", "CONFIRMED", "PROCESSING", "READY"])("1–3. %s is not shipped revenue", async (status) => {
    db.orders = [order(status, "500", OCT)];
    expect((await kpis()).series).toEqual([]);
  });

  it.each(["SHIPPED", "COMPLETED"])("4–5. %s is counted", async (status) => {
    db.orders = [order(status, "500", OCT)];
    const [series] = (await kpis()).series;
    expect(series.total).toBe("500");
    expect(series.monthly[11]).toBe("500");
  });
});

describe("getSalesPerformance — months", () => {
  it("6. Oct 2025 and Oct 2026 are different months (never merged)", async () => {
    // Oct 2025 is 12 months back → outside the Nov 2025 … Oct 2026 window.
    db.orders = [order("SHIPPED", "700", "2025-10-10T10:00:00.000Z"), order("SHIPPED", "300", OCT)];
    const { months, series } = await kpis();
    expect(months.map(monthKey)).not.toContain("2025-10");
    expect(series[0].monthly[11]).toBe("300");
    expect(series[0].total).toBe("300");

    // With Oct 2025 inside the window (now = Sep 2026) it sits in its own bucket.
    const september = await kpis(new Date("2026-09-15T09:00:00.000Z"));
    expect(september.months.map(monthKey)[0]).toBe("2025-10");
    expect(september.series[0].monthly[0]).toBe("700");
  });

  it("7. always 12 consecutive calendar months, empty ones as 0", async () => {
    db.orders = [order("SHIPPED", "100", "2026-01-20T10:00:00.000Z"), order("SHIPPED", "200", OCT)];
    const { months, series } = await kpis();
    expect(months.map(monthKey)).toEqual([
      "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04",
      "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10",
    ]);
    expect(series[0].monthly).toEqual(["0", "0", "100", "0", "0", "0", "0", "0", "0", "0", "0", "200"]);
    expect(lastKyivMonths(new Date("2026-01-10T12:00:00.000Z"), 3).map(monthKey)).toEqual([
      "2025-11", "2025-12", "2026-01",
    ]);
  });

  it("8. Europe/Kyiv month boundary, not UTC", async () => {
    db.orders = [
      // 1 Oct 2026 00:30 Kyiv (EEST, UTC+3) — still 30 Sep in UTC.
      order("SHIPPED", "10", "2026-09-30T21:30:00.000Z"),
      // 30 Sep 2026 23:59 Kyiv.
      order("SHIPPED", "20", "2026-09-30T20:59:00.000Z"),
    ];
    const { series } = await kpis();
    expect(series[0].monthly[11]).toBe("10"); // Oct
    expect(series[0].monthly[10]).toBe("20"); // Sep
    // Winter time (UTC+2): 1 Jan 2026 00:30 Kyiv = 31 Dec 2025 22:30 UTC.
    db.orders = [order("SHIPPED", "5", "2025-12-31T22:30:00.000Z")];
    const winter = await kpis();
    expect(winter.series[0].monthly[winter.months.findIndex((m) => monthKey(m) === "2026-01")]).toBe("5");
  });
});

describe("getSalesPerformance — currencies", () => {
  it("9 + 10. 1000 UAH + 100 EUR stay two totals, grouped by currency", async () => {
    db.orders = [order("SHIPPED", "1000", OCT, "UAH"), order("SHIPPED", "100", OCT, "EUR"), order("SHIPPED", "50", SEP, "EUR")];
    const { series } = await kpis();
    expect(series.map(({ currency, total }) => ({ currency, total }))).toEqual([
      { currency: "EUR", total: "150" },
      { currency: "UAH", total: "1000" },
    ]);
  });

  it("several currencies in the compared months → no trend", async () => {
    db.orders = [order("SHIPPED", "100", SEP, "UAH"), order("SHIPPED", "120", OCT, "UAH"), order("SHIPPED", "5", OCT, "EUR")];
    expect((await kpis()).trend).toBeNull();
  });
});

describe("getSalesPerformance — trend (current vs previous Kyiv calendar month)", () => {
  it("11. previous calendar month 0 → no trend (even with older months)", async () => {
    db.orders = [order("SHIPPED", "100", "2026-08-10T10:00:00.000Z"), order("SHIPPED", "120", OCT)];
    expect((await kpis()).trend).toBeNull();
  });

  it("both months 0 → no trend", async () => {
    db.orders = [order("SHIPPED", "100", "2026-05-10T10:00:00.000Z")];
    expect((await kpis()).trend).toBeNull();
  });

  it("12. 120 vs 100 → +20%", async () => {
    db.orders = [order("SHIPPED", "100", SEP), order("SHIPPED", "120", OCT)];
    expect((await kpis()).trend).toEqual({ currency: "UAH", direction: "up", percent: "20" });
  });

  it("13. 80 vs 100 → −20%", async () => {
    db.orders = [order("SHIPPED", "100", SEP), order("SHIPPED", "80", OCT)];
    expect((await kpis()).trend).toEqual({ currency: "UAH", direction: "down", percent: "20" });
  });

  it("equal months → flat", async () => {
    db.orders = [order("SHIPPED", "100", SEP), order("SHIPPED", "100", OCT)];
    expect((await kpis()).trend).toEqual({ currency: "UAH", direction: "flat", percent: "0" });
  });
});

describe("Sales Performance card", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("14 + 15. negative trend: red, down arrow, screen reader says down", async () => {
    db.orders = [order("SHIPPED", "100", SEP), order("SHIPPED", "80", OCT)];
    const html = await render();
    expect(html).toContain("−20%");
    expect(html).toContain("text-rose-600");
    expect(html).not.toContain("text-emerald-600");
    expect(html).toContain("lucide-arrow-down-right");
    // the only up-arrow left is the header "view report" button
    expect(html.split("lucide-arrow-up-right").length - 1).toBe(1);
    expect(ariaSummary(html)).toContain("down −20% vs last month");
    expect(ariaSummary(html)).not.toContain(" up ");
  });

  it("15. positive trend: green, up arrow, screen reader says up", async () => {
    db.orders = [order("SHIPPED", "100", SEP), order("SHIPPED", "120", OCT)];
    const html = await render();
    expect(html).toContain("+20%");
    expect(html).toContain("text-emerald-600");
    expect(html).not.toContain("lucide-arrow-down-right");
    expect(ariaSummary(html)).toContain("up +20% vs last month");
  });

  it("no comparison base: trend row hidden, screen reader says so", async () => {
    db.orders = [order("SHIPPED", "120", OCT)];
    const html = await render();
    expect(html).not.toContain("vs last month</span>");
    expect(html).not.toMatch(/[+−]\d/);
    expect(ariaSummary(html)).toContain("no comparison with last month");
  });

  it("16. empty database: 12 labels, neutral 0, no undefined / Infinity / NaN / +0.0%", async () => {
    const html = await render();
    for (const bad of ["undefined", "Infinity", "NaN", "+0.0%", "+0%"]) expect(html).not.toContain(bad);
    expect(html.match(/text-\[9px\]/g)).toHaveLength(12);
    expect(html).toContain(">0</span>");
    expect(html).not.toContain("UAH");
    expect(ariaSummary(html)).toBe(
      "Shipped sales by month, Nov 2025 through Oct 2026, no comparison with last month",
    );
  });

  it("10 + 17. totals per currency, locale-formatted, never summed", async () => {
    db.orders = [
      order("SHIPPED", "1000000.5", OCT, "UAH"),
      order("SHIPPED", "400", SEP, "UAH"),
      order("SHIPPED", "100", OCT, "EUR"),
    ];
    const en = await render("en");
    expect(en).toContain(formatKg("1000400.5", "en")); // 1,000,400.5
    expect(en).toContain(formatMoney("100", "EUR", "en"));
    expect(en).not.toContain("1000400.5"); // no raw Decimal string
    expect(en).not.toContain(formatKg("1000500.5", "en"));
    const uk = await render("uk");
    expect(uk).toContain(formatKg("1000400.5", "uk"));
    expect(formatKg("1000400.5", "uk")).not.toBe(formatKg("1000400.5", "en"));
  });
});
