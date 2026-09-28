import { FinanceStatus, Prisma } from "@/lib/generated/prisma/client";

/** Settled or voided records never carry an open balance, whatever their amounts say. */
const CLOSED_FINANCE_STATUSES: readonly string[] = [FinanceStatus.PAID, FinanceStatus.CANCELLED];

type FinanceRecord = {
  amount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  status: string;
};

/**
 * The open balance of one Receivable/Payable: amount - paidAmount, only for
 * a status other than PAID/CANCELLED and only when it is > 0 — otherwise
 * null. Same rule /finance, Sales exposure and customer aggregates use.
 * The stored OVERDUE status is never consulted (nothing sets it); an
 * OVERDUE-status record is simply open like OPEN/PARTIALLY_PAID.
 */
export function openOutstanding(record: FinanceRecord): Prisma.Decimal | null {
  if (CLOSED_FINANCE_STATUSES.includes(record.status)) return null;
  const outstanding = record.amount.minus(record.paidAmount);
  return outstanding.gt(0) ? outstanding : null;
}

/**
 * The overdue part of one record: its open balance when dueDate is set and
 * strictly before `now` (a record due exactly now is not yet overdue);
 * null otherwise, including dueDate = null.
 */
export function overdueOutstanding(
  record: FinanceRecord & { dueDate: Date | null },
  now: Date,
): Prisma.Decimal | null {
  if (record.dueDate === null || !(record.dueDate.getTime() < now.getTime())) return null;
  return openOutstanding(record);
}
