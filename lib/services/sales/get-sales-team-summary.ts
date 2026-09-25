import { FinanceStatus, Prisma, SalesOrderStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { attentionCustomerWhere, getAttentionCutoffs } from "@/lib/services/sales/attention-rules";
import { TERMINAL_SALES_ORDER_STATUSES } from "@/lib/services/sales/config";
import { decimalToString } from "@/lib/services/sales/decimal";

export type SalesTeamTurnover = {
  currency: string;
  amount: string;
};

export type SalesTeamReceivables = {
  currency: string;
  totalOutstanding: string;
  overdueOutstanding: string;
};

export type SalesTeamMetrics = {
  customerCount: number;
  activeOrderCount: number;
  attentionCount: number;
  /** All-time, per currency — never summed across currencies. */
  turnover: SalesTeamTurnover[];
  /** Per currency — never summed across currencies. */
  receivables: SalesTeamReceivables[];
};

export type SalesTeamManager = {
  id: string;
  name: string | null;
  email: string;
};

export type SalesTeamSummary = {
  /** One entry per active SALES user, including those with nothing assigned. */
  managers: (SalesTeamMetrics & { manager: SalesTeamManager })[];
  /**
   * Records whose responsibleId is null or not an active SALES user.
   * Kept separate so managers + outsideTeam always add up to total.
   */
  outsideTeam: SalesTeamMetrics;
  /** Company-wide: the sum of every manager bucket plus outsideTeam. */
  total: SalesTeamMetrics;
};

type Bucket = {
  customerCount: number;
  activeOrderCount: number;
  attentionCount: number;
  turnover: Map<string, Prisma.Decimal>;
  receivables: Map<string, { total: Prisma.Decimal; overdue: Prisma.Decimal }>;
};

const OUTSIDE_TEAM = "__outside_team__";

function emptyBucket(): Bucket {
  return {
    customerCount: 0,
    activeOrderCount: 0,
    attentionCount: 0,
    turnover: new Map(),
    receivables: new Map(),
  };
}

function addTurnover(bucket: Bucket, currency: string, amount: Prisma.Decimal) {
  bucket.turnover.set(currency, (bucket.turnover.get(currency) ?? new Prisma.Decimal(0)).plus(amount));
}

function addReceivable(
  bucket: Bucket,
  currency: string,
  outstanding: Prisma.Decimal,
  overdue: Prisma.Decimal,
) {
  const entry = bucket.receivables.get(currency) ?? {
    total: new Prisma.Decimal(0),
    overdue: new Prisma.Decimal(0),
  };
  entry.total = entry.total.plus(outstanding);
  entry.overdue = entry.overdue.plus(overdue);
  bucket.receivables.set(currency, entry);
}

function mergeInto(target: Bucket, source: Bucket) {
  target.customerCount += source.customerCount;
  target.activeOrderCount += source.activeOrderCount;
  target.attentionCount += source.attentionCount;
  for (const [currency, amount] of source.turnover) addTurnover(target, currency, amount);
  for (const [currency, entry] of source.receivables) {
    addReceivable(target, currency, entry.total, entry.overdue);
  }
}

function toMetrics(bucket: Bucket): SalesTeamMetrics {
  return {
    customerCount: bucket.customerCount,
    activeOrderCount: bucket.activeOrderCount,
    attentionCount: bucket.attentionCount,
    turnover: Array.from(bucket.turnover.entries())
      .map(([currency, amount]) => ({ currency, amount: decimalToString(amount) }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    receivables: Array.from(bucket.receivables.entries())
      .map(([currency, entry]) => ({
        currency,
        totalOutstanding: decimalToString(entry.total),
        overdueOutstanding: decimalToString(entry.overdue),
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
  };
}

/**
 * Company-wide sales summary broken down by responsible sales manager, for
 * a caller that has already resolved supervisory ("all") visibility. No
 * auth/permission/role-of-caller logic here — the page decides who may call
 * this, exactly like every other SALES service.
 *
 * Grouping keys: Customer.responsibleId for customers/attention,
 * SalesOrder.responsibleId for orders/turnover, and
 * Receivable.customer.responsibleId for receivables (same path as
 * getReceivableExposure — salesOrderId is nullable and would drop rows).
 * Metric rules mirror the existing services:
 *   - customers: isActive only (as listSalesCustomers)
 *   - attention: attention-rules.ts (shared with getAttentionCustomers)
 *   - active orders: status not in TERMINAL_SALES_ORDER_STATUSES
 *   - turnover: all-time sum of quantityKg * pricePerKg, excluding CANCELLED
 *   - receivables: excludes PAID/CANCELLED, outstanding = amount - paidAmount,
 *     non-positive outstanding skipped, overdue = dueDate < now
 * Money stays per currency end to end — never summed across currencies.
 */
export async function getSalesTeamSummary(): Promise<SalesTeamSummary> {
  const cutoffs = getAttentionCutoffs();

  const [managers, customers, attentionCustomers, orders, receivables] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, roles: { some: { role: { code: "SALES" } } } },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
    prisma.customer.findMany({
      where: { isActive: true },
      select: { responsibleId: true },
    }),
    prisma.customer.findMany({
      where: { isActive: true, ...attentionCustomerWhere(cutoffs) },
      select: { responsibleId: true },
    }),
    prisma.salesOrder.findMany({
      where: { status: { not: SalesOrderStatus.CANCELLED } },
      select: {
        responsibleId: true,
        status: true,
        currency: true,
        items: { select: { quantityKg: true, pricePerKg: true } },
      },
    }),
    prisma.receivable.findMany({
      where: { status: { notIn: [FinanceStatus.PAID, FinanceStatus.CANCELLED] } },
      select: {
        currency: true,
        amount: true,
        paidAmount: true,
        dueDate: true,
        customer: { select: { responsibleId: true } },
      },
    }),
  ]);

  const buckets = new Map<string, Bucket>();
  for (const manager of managers) buckets.set(manager.id, emptyBucket());
  buckets.set(OUTSIDE_TEAM, emptyBucket());

  const bucketFor = (responsibleId: string | null): Bucket =>
    (responsibleId !== null ? buckets.get(responsibleId) : undefined) ?? buckets.get(OUTSIDE_TEAM)!;

  for (const customer of customers) {
    bucketFor(customer.responsibleId).customerCount += 1;
  }

  for (const customer of attentionCustomers) {
    bucketFor(customer.responsibleId).attentionCount += 1;
  }

  for (const order of orders) {
    const bucket = bucketFor(order.responsibleId);
    if (!TERMINAL_SALES_ORDER_STATUSES.includes(order.status)) {
      bucket.activeOrderCount += 1;
    }
    const orderTotal = order.items.reduce(
      (sum, item) => sum.plus(item.quantityKg.mul(item.pricePerKg)),
      new Prisma.Decimal(0),
    );
    addTurnover(bucket, order.currency, orderTotal);
  }

  for (const receivable of receivables) {
    const outstanding = receivable.amount.minus(receivable.paidAmount);
    if (outstanding.lte(0)) continue;
    const isOverdue = receivable.dueDate !== null && receivable.dueDate < cutoffs.now;
    addReceivable(
      bucketFor(receivable.customer.responsibleId),
      receivable.currency,
      outstanding,
      isOverdue ? outstanding : new Prisma.Decimal(0),
    );
  }

  const total = emptyBucket();
  for (const bucket of buckets.values()) mergeInto(total, bucket);

  return {
    managers: managers.map((manager) => ({
      manager,
      ...toMetrics(buckets.get(manager.id)!),
    })),
    outsideTeam: toMetrics(buckets.get(OUTSIDE_TEAM)!),
    total: toMetrics(total),
  };
}
