import { Prisma, SalesOrderStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSalesPerformance } from "@/lib/services/dashboard/get-sales-performance";
import {
  addToCurrencyTotals,
  openOutstanding,
  overdueOutstanding,
  toCurrencyAmounts,
  type CurrencyAmount,
} from "@/lib/services/finance/outstanding";

/** Orders Warehouse/Sales are working on right now. */
const ACTIVE_ORDER_STATUSES: SalesOrderStatus[] = [
  SalesOrderStatus.CONFIRMED,
  SalesOrderStatus.PROCESSING,
  SalesOrderStatus.READY,
];

/**
 * Presentation order only: the primary sales currency first (if present),
 * then the rest in currency-code order as toCurrencyAmounts already returns
 * them. Amounts are untouched and never combined.
 */
function primaryCurrencyFirst(amounts: CurrencyAmount[], primary: string | null): CurrencyAmount[] {
  if (primary === null) return amounts;
  const head = amounts.filter((entry) => entry.currency === primary);
  return head.length === 0 ? amounts : [...head, ...amounts.filter((entry) => entry.currency !== primary)];
}

export type CommandCenterKpis = {
  /**
   * Shipped revenue for the last 12 Kyiv calendar months, per currency —
   * exactly the totals of getSalesPerformance (same rule, same query), never
   * summed across currencies. Empty = nothing shipped. Ordered like the Sales
   * Performance card: the currency with the most shipped orders first, then
   * by code, so the main business currency is the headline line.
   */
  revenue12m: CurrencyAmount[];
  receivables: {
    /** Open balances per currency (empty = none); never summed across currencies. */
    outstanding: CurrencyAmount[];
    /** The overdue part of those balances, per currency. */
    overdueOutstanding: CurrencyAmount[];
  };
  payables: {
    /** Open balances per currency (empty = none); never summed across currencies. */
    outstanding: CurrencyAmount[];
  };
  /** Count of CONFIRMED + PROCESSING + READY sales orders. */
  activeOrders: {
    count: number;
    /**
     * The same active sales orders split by their real status, in pipeline
     * order (confirmed → processing → ready). Every active status is always
     * present, zero included, and the counts add up to `count` exactly.
     */
    byStatus: { status: SalesOrderStatus; count: number }[];
  };
};

/**
 * Receivable/payable balances are open balances only (openOutstanding: not
 * PAID/CANCELLED, amount - paidAmount > 0), grouped by each record's own
 * currency — no conversion, no cross-currency sum. Overdue = open balance
 * with dueDate strictly before `now`.
 */
export async function getCommandCenterKpis(now: Date = new Date()): Promise<CommandCenterKpis> {
  const [salesPerformance, activeOrderCounts] = await Promise.all([
    getSalesPerformance(now),
    // One count per active status; the headline total is their sum, so the
    // breakdown can never disagree with it.
    Promise.all(
      ACTIVE_ORDER_STATUSES.map((status) => prisma.salesOrder.count({ where: { status: { in: [status] } } })),
    ),
  ]);
  const activeOrdersByStatus = ACTIVE_ORDER_STATUSES.map((status, index) => ({
    status,
    count: activeOrderCounts[index],
  }));

  const receivables = await prisma.receivable.findMany({
    select: {
      amount: true,
      paidAmount: true,
      currency: true,
      status: true,
      dueDate: true,
    },
  });

  const receivableOutstanding = new Map<string, Prisma.Decimal>();
  const overdueReceivable = new Map<string, Prisma.Decimal>();

  for (const receivable of receivables) {
    const outstanding = openOutstanding(receivable);
    if (outstanding) {
      addToCurrencyTotals(receivableOutstanding, receivable.currency, outstanding);
    }

    const overdue = overdueOutstanding(receivable, now);
    if (overdue) {
      addToCurrencyTotals(overdueReceivable, receivable.currency, overdue);
    }
  }

  const payables = await prisma.payable.findMany({
    select: {
      amount: true,
      paidAmount: true,
      currency: true,
      status: true,
    },
  });

  const payableOutstanding = new Map<string, Prisma.Decimal>();

  for (const payable of payables) {
    const outstanding = openOutstanding(payable);
    if (outstanding) {
      addToCurrencyTotals(payableOutstanding, payable.currency, outstanding);
    }
  }

  const revenue12m = [...salesPerformance.series]
    .sort((a, b) => b.orderCount - a.orderCount || (a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0))
    .map(({ currency, total }) => ({ currency, amount: total }));
  // Primary sales currency = the one with the most SHIPPED/COMPLETED orders
  // in the same 12 months (the Sales Performance / revenue headline). None
  // when nothing shipped → plain currency-code order everywhere.
  const primaryCurrency = revenue12m[0]?.currency ?? null;

  // No cash/bank model and no COGS exist, so the Owner Dashboard shows no
  // cash or gross-margin figure at all rather than a placeholder zero.
  return {
    revenue12m,

    receivables: {
      outstanding: primaryCurrencyFirst(toCurrencyAmounts(receivableOutstanding), primaryCurrency),
      overdueOutstanding: primaryCurrencyFirst(toCurrencyAmounts(overdueReceivable), primaryCurrency),
    },

    payables: {
      outstanding: primaryCurrencyFirst(toCurrencyAmounts(payableOutstanding), primaryCurrency),
    },

    activeOrders: {
      count: activeOrdersByStatus.reduce((sum, entry) => sum + entry.count, 0),
      byStatus: activeOrdersByStatus,
    },
  };
}
