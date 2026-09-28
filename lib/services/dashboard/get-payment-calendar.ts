import { FinanceStatus, Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { openOutstanding } from "@/lib/services/finance/outstanding";

/** Events the card shows. */
export const PAYMENT_CALENDAR_LIMIT = 5;
/** When upcoming events exist, at most this many slots go to overdue ones; unused slots go to the other group. */
const OVERDUE_SLOTS = 2;
/**
 * Rows fetched per table per group. Status-open rows whose outstanding is
 * <= 0 are dropped after the fetch, so a small buffer keeps the list full.
 */
const FETCH_PER_GROUP = 20;

const CLOSED_STATUSES = [FinanceStatus.PAID, FinanceStatus.CANCELLED];

export type PaymentCalendarData = {
  id: string;
  eventType: "supplierPayment" | "customerReceipt";
  /** Full due instant (ISO); the card shows its Europe/Kyiv calendar day. */
  dueDate: string;
  /** Open balance (amount - paidAmount), never the original amount. */
  amount: string;
  currency: string;
  /** Actual lateness: dueDate < now. The stored OVERDUE status is never consulted. */
  status: "overdue" | "positive" | "upcoming";
};

type FinanceRow = {
  id: string;
  amount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  currency: string;
  status: string;
  dueDate: Date | null;
};

type Candidate = { row: FinanceRow & { dueDate: Date }; outstanding: Prisma.Decimal; kind: "receivable" | "payable" };

const select = { id: true, amount: true, paidAmount: true, currency: true, status: true, dueDate: true } as const;

function byDueDate(direction: 1 | -1) {
  return (a: Candidate, b: Candidate) =>
    direction * (a.row.dueDate.getTime() - b.row.dueDate.getTime()) ||
    direction * (a.row.id < b.row.id ? -1 : a.row.id > b.row.id ? 1 : 0);
}

function toCandidates(rows: FinanceRow[], kind: Candidate["kind"]): Candidate[] {
  const candidates: Candidate[] = [];
  for (const row of rows) {
    const outstanding = openOutstanding(row);
    if (row.dueDate === null || outstanding === null) continue;
    candidates.push({ row: { ...row, dueDate: row.dueDate }, outstanding, kind });
  }
  return candidates;
}

/**
 * Open Receivables (customer receipts) and Payables (supplier payments)
 * with a due date: outstanding = amount - paidAmount > 0, PAID/CANCELLED
 * excluded, each in its own currency.
 *
 * Selection: the most recently overdue records (dueDate < now, latest
 * first) and the nearest upcoming ones (dueDate >= now, soonest first).
 * With both present, overdue gets up to OVERDUE_SLOTS of the
 * PAYMENT_CALENDAR_LIMIT slots; either group fills slots the other leaves
 * empty. The result is ordered chronologically by the full dueDate (year
 * included), id as the tie-breaker.
 */
export async function getPaymentCalendar(now: Date = new Date()): Promise<PaymentCalendarData[]> {
  const open = { status: { notIn: CLOSED_STATUSES } };
  const overdueQuery = {
    where: { ...open, dueDate: { lt: now } },
    orderBy: [{ dueDate: "desc" as const }, { id: "desc" as const }],
    take: FETCH_PER_GROUP,
    select,
  };
  const upcomingQuery = {
    where: { ...open, dueDate: { gte: now } },
    orderBy: [{ dueDate: "asc" as const }, { id: "asc" as const }],
    take: FETCH_PER_GROUP,
    select,
  };

  const [overdueReceivables, upcomingReceivables, overduePayables, upcomingPayables] = await Promise.all([
    prisma.receivable.findMany(overdueQuery),
    prisma.receivable.findMany(upcomingQuery),
    prisma.payable.findMany(overdueQuery),
    prisma.payable.findMany(upcomingQuery),
  ]);

  const overdue = [
    ...toCandidates(overdueReceivables, "receivable"),
    ...toCandidates(overduePayables, "payable"),
  ].sort(byDueDate(-1));
  const upcoming = [
    ...toCandidates(upcomingReceivables, "receivable"),
    ...toCandidates(upcomingPayables, "payable"),
  ].sort(byDueDate(1));

  const overdueCount = Math.min(
    overdue.length,
    Math.max(OVERDUE_SLOTS, PAYMENT_CALENDAR_LIMIT - upcoming.length),
  );
  const upcomingCount = Math.min(upcoming.length, PAYMENT_CALENDAR_LIMIT - overdueCount);

  return [...overdue.slice(0, overdueCount), ...upcoming.slice(0, upcomingCount)]
    .sort(byDueDate(1))
    .map(({ row, outstanding, kind }) => {
      const isOverdue = row.dueDate.getTime() < now.getTime();
      return {
        id: row.id,
        eventType: kind === "receivable" ? "customerReceipt" : "supplierPayment",
        dueDate: row.dueDate.toISOString(),
        amount: outstanding.toString(),
        currency: row.currency,
        status: isOverdue ? "overdue" : kind === "receivable" ? "positive" : "upcoming",
      };
    });
}
