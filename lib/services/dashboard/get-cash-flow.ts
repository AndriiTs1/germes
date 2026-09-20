import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type CashFlowData = {
  value: string;
  unit: string;
  trendValue: string;
  monthIndex: number;
  year: number;
  points: number[];
};

export async function getCashFlow(): Promise<CashFlowData> {
  const receivables = await prisma.receivable.findMany({
    select: {
      amount: true,
      paidAmount: true,
      currency: true,
      status: true,
      dueDate: true,
    },
  });

  const payables = await prisma.payable.findMany({
    select: {
      amount: true,
      paidAmount: true,
      currency: true,
      status: true,
      dueDate: true,
    },
  });

  let incoming = new Prisma.Decimal(0);
  let outgoing = new Prisma.Decimal(0);

  let currency = "UAH";

  for (const receivable of receivables) {
    currency = receivable.currency;

    incoming = incoming.plus(
      receivable.amount.minus(receivable.paidAmount),
    );
  }

  for (const payable of payables) {
    currency = payable.currency;

    outgoing = outgoing.plus(
      payable.amount.minus(payable.paidAmount),
    );
  }

  const netFlow = incoming.minus(outgoing);

  const points = [
    0,
    Math.round(Number(netFlow.div(3).toString())),
    Math.round(Number(netFlow.div(1.5).toString())),
    Math.round(Number(netFlow.toString())),
  ];

  const trend =
    netFlow.gt(0)
      ? 0
      : netFlow.div(incoming).mul(100).toNumber();

  return {
    value: netFlow.toString(),
    unit: currency,
    trendValue: `${trend >= 0 ? "+" : ""}${trend.toFixed(1)}%`,
    monthIndex: 8,
    year: 2026,
    points,
  };
}
