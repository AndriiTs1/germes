import { Prisma, SalesOrderStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

/** Revenue counts only once goods have actually left the warehouse. */
const SHIPPED_STATUSES: SalesOrderStatus[] = [SalesOrderStatus.SHIPPED, SalesOrderStatus.COMPLETED];

const BUSINESS_TIME_ZONE = "Europe/Kyiv";
const MONTH_COUNT = 12;

/** A calendar month in Europe/Kyiv; month is 1-12. */
export type SalesMonth = { year: number; month: number };

export type SalesPerformanceSeries = {
  currency: string;
  /** Sum over the whole 12-month window. */
  total: string;
  /** One amount per entry of `months`, same order; "0" for a month without shipments. */
  monthly: string[];
  /** Shipped orders in the window — only used to pick the charted currency. */
  orderCount: number;
};

export type SalesPerformanceTrend = {
  currency: string;
  direction: "up" | "down" | "flat";
  /** Absolute change, rounded to one decimal place, e.g. "20" or "12.5". */
  percent: string;
};

export type SalesPerformanceData = {
  /** The last 12 Kyiv calendar months, oldest first, ending with the current one. */
  months: SalesMonth[];
  /** One entry per currency (by code), never summed across currencies. Empty when nothing shipped. */
  series: SalesPerformanceSeries[];
  /** Current vs previous Kyiv calendar month; null when there is no honest base for a percentage. */
  trend: SalesPerformanceTrend | null;
};

const kyivMonthFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "numeric",
});

/** The Kyiv calendar month an instant falls in. */
export function toKyivMonth(date: Date): SalesMonth {
  const parts = kyivMonthFormatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return { year, month };
}

export function monthKey({ year, month }: SalesMonth): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** The last `count` Kyiv calendar months ending with the one `now` falls in, oldest first. */
export function lastKyivMonths(now: Date, count: number = MONTH_COUNT): SalesMonth[] {
  const current = toKyivMonth(now);
  const months: SalesMonth[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const index = current.year * 12 + (current.month - 1) - offset;
    months.push({ year: Math.floor(index / 12), month: (index % 12) + 1 });
  }
  return months;
}

/**
 * Shipped (SHIPPED/COMPLETED) sales for the last 12 Kyiv calendar months,
 * bucketed by year-month of shippedAt (orderDate when shippedAt is missing),
 * separately per currency — no FX, no base currency.
 */
export async function getSalesPerformance(now: Date = new Date()): Promise<SalesPerformanceData> {
  const months = lastKyivMonths(now);
  const monthIndexByKey = new Map(months.map((month, index) => [monthKey(month), index]));

  // Kyiv is never more than a few hours ahead of UTC, so UTC midnight one day
  // before the first month safely covers it; exact bucketing happens below.
  const first = months[0];
  const lowerBound = new Date(Date.UTC(first.year, first.month - 1, 1) - 24 * 60 * 60 * 1000);

  const orders = await prisma.salesOrder.findMany({
    where: {
      status: { in: SHIPPED_STATUSES },
      OR: [{ shippedAt: { gte: lowerBound } }, { shippedAt: null, orderDate: { gte: lowerBound } }],
    },
    select: {
      currency: true,
      orderDate: true,
      shippedAt: true,
      items: { select: { quantityKg: true, pricePerKg: true } },
    },
  });

  const byCurrency = new Map<string, { monthly: Prisma.Decimal[]; orderCount: number }>();

  for (const order of orders) {
    const index = monthIndexByKey.get(monthKey(toKyivMonth(order.shippedAt ?? order.orderDate)));
    if (index === undefined) continue; // outside the window (e.g. future-dated)

    const orderTotal = order.items.reduce(
      (sum, item) => sum.plus(item.quantityKg.mul(item.pricePerKg)),
      new Prisma.Decimal(0),
    );

    const bucket = byCurrency.get(order.currency) ?? {
      monthly: months.map(() => new Prisma.Decimal(0)),
      orderCount: 0,
    };
    bucket.monthly[index] = bucket.monthly[index].plus(orderTotal);
    bucket.orderCount += 1;
    byCurrency.set(order.currency, bucket);
  }

  const series: SalesPerformanceSeries[] = [...byCurrency.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([currency, { monthly, orderCount }]) => ({
      currency,
      total: monthly.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0)).toString(),
      monthly: monthly.map((value) => value.toString()),
      orderCount,
    }));

  return { months, series, trend: computeTrend(byCurrency, months.length) };
}

/**
 * Only when the current and the previous month each have shipments in
 * exactly one — the same — currency (so the previous month is > 0).
 * Anything else — no shipments in either month, several currencies —
 * has no single honest comparison base, so no trend.
 */
function computeTrend(
  byCurrency: Map<string, { monthly: Prisma.Decimal[] }>,
  monthCount: number,
): SalesPerformanceTrend | null {
  const current = monthCount - 1;
  const previous = monthCount - 2;

  const currentCurrencies = [...byCurrency.keys()].filter((c) => byCurrency.get(c)!.monthly[current].gt(0));
  const previousCurrencies = [...byCurrency.keys()].filter((c) => byCurrency.get(c)!.monthly[previous].gt(0));

  if (previousCurrencies.length !== 1 || currentCurrencies.length !== 1) return null;
  const currency = previousCurrencies[0];
  if (currentCurrencies[0] !== currency) return null;

  const { monthly } = byCurrency.get(currency)!;
  const change = monthly[current].minus(monthly[previous]).div(monthly[previous]).mul(100);
  const rounded = change.toDecimalPlaces(1);

  return {
    currency,
    direction: rounded.isZero() ? "flat" : rounded.gt(0) ? "up" : "down",
    percent: rounded.abs().toString(),
  };
}
