import { FinanceStatus, Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  addToCurrencyTotals,
  openOutstanding,
  overdueOutstanding,
  toCurrencyAmounts,
} from "@/lib/services/finance/outstanding";

export type AttentionItemData = {
  kind:
    | "overdueCustomerPayments"
    | "openSupplierPayables"
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

  // Open supplier balances: PAID/CANCELLED excluded, outstanding > 0 only,
  // one item per currency (never summed across currencies).
  const payables = await prisma.payable.findMany({
    where: {
      status: { notIn: [FinanceStatus.PAID, FinanceStatus.CANCELLED] },
    },
    select: {
      amount: true,
      paidAmount: true,
      currency: true,
      status: true,
    },
  });

  const openPayablesByCurrency = new Map<string, Prisma.Decimal>();
  for (const payable of payables) {
    const outstanding = openOutstanding(payable);
    if (outstanding) addToCurrencyTotals(openPayablesByCurrency, payable.currency, outstanding);
  }

  for (const { currency, amount } of toCurrencyAmounts(openPayablesByCurrency)) {
    items.push({
      kind: "openSupplierPayables",
      value: `${amount} ${currency}`,
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
