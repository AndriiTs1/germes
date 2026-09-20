import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type AttentionItemData = {
  kind:
    | "overdueCustomerPayments"
    | "supplierInvoiceAwaitingApproval"
    | "lowStock"
    | "supplierPaymentDueTomorrow"
    | "ordersAwaitingShipment";
  productName?: string;
  value?: string;
  count?: number;
};

export async function getAttentionItems(): Promise<AttentionItemData[]> {
  const items: AttentionItemData[] = [];

  const receivables = await prisma.receivable.findMany({
    where: {
      status: "OVERDUE",
    },
    select: {
      amount: true,
      paidAmount: true,
      currency: true,
    },
  });

  const overdueAmount = receivables.reduce(
    (sum, item) =>
      sum.plus(item.amount.minus(item.paidAmount)),
    new Prisma.Decimal(0),
  );

  if (overdueAmount.gt(0)) {
    items.push({
      kind: "overdueCustomerPayments",
      value: `${overdueAmount.toString()} UAH`,
    });
  }

  const payables = await prisma.payable.findMany({
    where: {
      status: {
        not: "PAID",
      },
    },
    select: {
      amount: true,
      paidAmount: true,
      currency: true,
    },
  });

  const payableAmount = payables.reduce(
    (sum, item) =>
      sum.plus(item.amount.minus(item.paidAmount)),
    new Prisma.Decimal(0),
  );

  if (payableAmount.gt(0)) {
    items.push({
      kind: "supplierInvoiceAwaitingApproval",
      value: `${payableAmount.toString()} UAH`,
    });
  }

  const ordersCount = await prisma.salesOrder.count({
    where: {
      status: "CONFIRMED",
    },
  });

  if (ordersCount > 0) {
    items.push({
      kind: "ordersAwaitingShipment",
      count: ordersCount,
    });
  }

  return items;
}
