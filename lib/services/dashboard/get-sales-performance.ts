import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type SalesPerformanceData = {
  value: string;
  unit: string;
  trendValue: string;
  months: {
    monthIndex: number;
    pct: number;
  }[];
};

export async function getSalesPerformance(): Promise<SalesPerformanceData> {
  const orders = await prisma.salesOrder.findMany({
    select: {
      orderDate: true,
      currency: true,
      items: {
        select: {
          quantityKg: true,
          pricePerKg: true,
        },
      },
    },
  });

  let total = new Prisma.Decimal(0);
  const monthly = new Map<number, Prisma.Decimal>();

  let currency = "UAH";

  for (const order of orders) {
    currency = order.currency;

    const month = order.orderDate.getMonth();

    let orderTotal = new Prisma.Decimal(0);

    for (const item of order.items) {
      orderTotal = orderTotal.plus(
        item.quantityKg.mul(item.pricePerKg),
      );
    }

    total = total.plus(orderTotal);

    monthly.set(
      month,
      (monthly.get(month) ?? new Prisma.Decimal(0)).plus(orderTotal),
    );
  }

  const values = Array.from(monthly.values()).map((v) => Number(v));
  const max = Math.max(...values, 1);

  const months = Array.from(monthly.entries())
    .sort(([a], [b]) => a - b)
    .map(([monthIndex, value]) => ({
      monthIndex,
      pct: Math.round((Number(value) / max) * 100),
    }));

  const sortedValues = Array.from(monthly.entries())
    .sort(([a], [b]) => a - b)
    .map(([, value]) => Number(value));

  const previousMonth = sortedValues[sortedValues.length - 2] ?? 0;
  const currentMonth = sortedValues[sortedValues.length - 1] ?? 0;

  const trend =
    previousMonth > 0
      ? ((currentMonth - previousMonth) / previousMonth) * 100
      : 0;

  return {
    value: total.toString(),
    unit: currency,
    trendValue: `${trend >= 0 ? "+" : ""}${trend.toFixed(1)}%`,
    months,
  };
}
