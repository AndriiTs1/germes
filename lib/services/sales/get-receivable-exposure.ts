import { FinanceStatus, Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToString } from "@/lib/services/sales/decimal";
import { RECEIVABLE_DUE_SOON_DAYS } from "@/lib/services/sales/config";

export type ReceivableExposureByCurrency = {
  currency: string;
  totalOutstanding: string;
  overdueOutstanding: string;
  dueSoonOutstanding: string;
  affectedCustomerCount: number;
  affectedReceivableCount: number;
};

type CurrencyBucket = {
  totalOutstanding: Prisma.Decimal;
  overdueOutstanding: Prisma.Decimal;
  dueSoonOutstanding: Prisma.Decimal;
  customerIds: Set<string>;
  receivableCount: number;
};

/**
 * Read-only receivable exposure for customers assigned to currentUserId.
 * Scoped via Receivable.customer.responsibleId (not salesOrderId, which is
 * nullable and would silently drop receivables not tied to an order).
 *
 * Overdue/due-soon are derived from dueDate + the live outstanding balance
 * (amount - paidAmount), not from the stored FinanceStatus, since that
 * status can drift out of sync with reality. Grouped by currency — never
 * summed across currencies, even though current data happens to be UAH
 * only (schema allows any string).
 */
export async function getReceivableExposure(
  currentUserId: string,
): Promise<ReceivableExposureByCurrency[]> {
  const now = new Date();
  const dueSoonBefore = new Date(
    now.getTime() + RECEIVABLE_DUE_SOON_DAYS * 24 * 60 * 60 * 1000,
  );

  const receivables = await prisma.receivable.findMany({
    where: {
      customer: { responsibleId: currentUserId },
      status: { notIn: [FinanceStatus.PAID, FinanceStatus.CANCELLED] },
    },
    select: {
      customerId: true,
      currency: true,
      amount: true,
      paidAmount: true,
      dueDate: true,
    },
  });

  const byCurrency = new Map<string, CurrencyBucket>();

  for (const receivable of receivables) {
    const outstanding = receivable.amount.minus(receivable.paidAmount);
    if (outstanding.lte(0)) continue;

    const bucket: CurrencyBucket = byCurrency.get(receivable.currency) ?? {
      totalOutstanding: new Prisma.Decimal(0),
      overdueOutstanding: new Prisma.Decimal(0),
      dueSoonOutstanding: new Prisma.Decimal(0),
      customerIds: new Set<string>(),
      receivableCount: 0,
    };

    bucket.totalOutstanding = bucket.totalOutstanding.plus(outstanding);
    bucket.customerIds.add(receivable.customerId);
    bucket.receivableCount += 1;

    const isOverdue = receivable.dueDate !== null && receivable.dueDate < now;
    const isDueSoon =
      receivable.dueDate !== null &&
      receivable.dueDate >= now &&
      receivable.dueDate <= dueSoonBefore;

    if (isOverdue) {
      bucket.overdueOutstanding = bucket.overdueOutstanding.plus(outstanding);
    } else if (isDueSoon) {
      bucket.dueSoonOutstanding = bucket.dueSoonOutstanding.plus(outstanding);
    }

    byCurrency.set(receivable.currency, bucket);
  }

  return Array.from(byCurrency.entries())
    .map(([currency, bucket]) => ({
      currency,
      totalOutstanding: decimalToString(bucket.totalOutstanding),
      overdueOutstanding: decimalToString(bucket.overdueOutstanding),
      dueSoonOutstanding: decimalToString(bucket.dueSoonOutstanding),
      affectedCustomerCount: bucket.customerIds.size,
      affectedReceivableCount: bucket.receivableCount,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}
