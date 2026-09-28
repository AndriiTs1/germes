import { FinanceStatus, Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { overdueOutstanding } from "@/lib/services/finance/outstanding";

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

export async function getAttentionItems(now: Date = new Date()): Promise<AttentionItemData[]> {
  const items: AttentionItemData[] = [];

  // Actual overdue (open balance, dueDate strictly before now) — never the
  // stored OVERDUE status, which nothing sets. The DB narrows by status and
  // dueDate; the balance itself is checked in Decimal by overdueOutstanding.
  const receivables = await prisma.receivable.findMany({
    where: {
      status: { notIn: [FinanceStatus.PAID, FinanceStatus.CANCELLED] },
      dueDate: { lt: now },
    },
    select: {
      amount: true,
      paidAmount: true,
      currency: true,
      status: true,
      dueDate: true,
    },
  });

  // One item per currency, in that record currency — amounts in different
  // currencies are never added together.
  const overdueByCurrency = new Map<string, Prisma.Decimal>();
  for (const receivable of receivables) {
    const overdue = overdueOutstanding(receivable, now);
    if (!overdue) continue;
    overdueByCurrency.set(
      receivable.currency,
      (overdueByCurrency.get(receivable.currency) ?? new Prisma.Decimal(0)).plus(overdue),
    );
  }

  for (const [currency, amount] of [...overdueByCurrency.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    items.push({
      kind: "overdueCustomerPayments",
      value: `${amount.toString()} ${currency}`,
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
