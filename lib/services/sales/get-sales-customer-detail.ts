import { FinanceStatus, Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToString } from "@/lib/services/sales/decimal";
import type { SalesReadScope } from "@/lib/services/sales/read-scope";

export type SalesCustomerDetailOrder = {
  id: string;
  orderNumber: string;
  status: string;
  orderDate: string;
  requestedDate: string | null;
  totalQuantityKg: string;
  totalValue: string;
  currency: string;
};

export type CustomerReceivableSummary = {
  currency: string;
  totalOutstanding: string;
  overdueOutstanding: string;
};

export type SalesCustomerDetailReceivableRow = {
  id: string;
  salesOrderId: string | null;
  amount: string;
  paidAmount: string;
  outstanding: string;
  currency: string;
  dueDate: string | null;
  status: string;
  reference: string | null;
};

export type SalesCustomerDetail = {
  id: string;
  code: string;
  name: string;
  status: string;
  legalName: string | null;
  taxId: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  country: string | null;
  /** Stored standalone numeric commercial term — schema has no currency for this field. Never combine with receivables. */
  creditLimit: string | null;
  paymentTermDays: number;
  lastContactAt: string | null;
  lastPurchaseAt: string | null;
  nextActionAt: string | null;
  notes: string | null;
  recentOrders: SalesCustomerDetailOrder[];
  /**
   * null when includeReceivables was false (not fetched at all — the
   * caller lacks finance.receivables.read). An empty array means it WAS
   * fetched and there is genuinely nothing outstanding.
   */
  receivables: CustomerReceivableSummary[] | null;
  receivableDetails: SalesCustomerDetailReceivableRow[] | null;
};

export type GetSalesCustomerDetailOptions = {
  /**
   * Read visibility. Defaults to "own" so every existing caller preserves
   * salesperson isolation unless it explicitly opts into supervisory reads.
   */
  scope?: SalesReadScope;
  /**
   * Whether to fetch receivable data at all. Defaults to false (fail
   * closed): the caller (the page) must explicitly pass true only after
   * confirming the current user holds finance.receivables.read, so a
   * missing permission check never accidentally still queries finance
   * data and merely hides it in the UI.
   */
  includeReceivables?: boolean;
};

/**
 * Full detail for exactly one customer visible in the requested read
 * scope. The default "own" scope keeps id + responsibleId + isActive
 * together in the query (via findFirst); "all" drops only responsibleId
 * and is reserved for a caller that has already resolved supervisory
 * visibility — identical philosophy to getSalesOrderDetail. "Doesn't
 * exist", "belongs to someone else", and "is inactive" are all
 * indistinguishable — every case resolves to null from this single query,
 * never a separate existence check. No role.code logic here.
 *
 * Recent orders come from the same scoped customer record's own
 * salesOrders relation (nested select — Prisma resolves this as part of
 * the same query plan, no extra round trip) and are deliberately NOT
 * additionally filtered by responsibleId: the customer itself is already
 * the scope boundary, and Order Detail independently re-scopes by
 * responsibleId when a link is followed, so it is safe for this list to
 * show the customer's real order history regardless of which salesperson
 * was responsible for each individual order.
 *
 * Receivables are fetched via one additional batched query, only when
 * includeReceivables is true, so a caller without finance.receivables.read
 * never causes finance data to leave the database at all (not merely
 * hidden in the UI). Aggregation reuses the exact rules already
 * established in getReceivableExposure/listSalesCustomers: excludes
 * PAID/CANCELLED, outstanding = amount - paidAmount, skips non-positive
 * outstanding, overdue derived from dueDate vs now, grouped by currency,
 * never summed across currencies.
 *
 * lastPurchaseAt is Customer's own stored field, used directly — never
 * derived from SalesOrder history, per the V1 decision already documented
 * in listSalesCustomers.
 */
export async function getSalesCustomerDetail(
  currentUserId: string,
  customerId: string,
  options: GetSalesCustomerDetailOptions = {},
): Promise<SalesCustomerDetail | null> {
  const { scope = "own", includeReceivables = false } = options;

  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      responsibleId: scope === "all" ? undefined : currentUserId,
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      legalName: true,
      taxId: true,
      contactPerson: true,
      phone: true,
      email: true,
      address: true,
      country: true,
      creditLimit: true,
      paymentTermDays: true,
      lastContactAt: true,
      lastPurchaseAt: true,
      nextActionAt: true,
      notes: true,
      salesOrders: {
        orderBy: { orderDate: "desc" },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          orderDate: true,
          requestedDate: true,
          currency: true,
          items: {
            select: {
              quantityKg: true,
              pricePerKg: true,
            },
          },
        },
      },
    },
  });

  if (!customer) return null;

  const recentOrders: SalesCustomerDetailOrder[] = customer.salesOrders.map((order) => {
    let totalQuantityKg = new Prisma.Decimal(0);
    let totalValue = new Prisma.Decimal(0);

    for (const item of order.items) {
      totalQuantityKg = totalQuantityKg.plus(item.quantityKg);
      totalValue = totalValue.plus(item.quantityKg.times(item.pricePerKg));
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      orderDate: order.orderDate.toISOString(),
      requestedDate: order.requestedDate?.toISOString() ?? null,
      totalQuantityKg: decimalToString(totalQuantityKg),
      totalValue: decimalToString(totalValue),
      currency: order.currency,
    };
  });

  let receivables: CustomerReceivableSummary[] | null = null;
  let receivableDetails: SalesCustomerDetailReceivableRow[] | null = null;

  if (includeReceivables) {
    const rawReceivables = await prisma.receivable.findMany({
      where: {
        customerId: customer.id,
        status: { notIn: [FinanceStatus.PAID, FinanceStatus.CANCELLED] },
      },
      select: {
        id: true,
        salesOrderId: true,
        amount: true,
        paidAmount: true,
        currency: true,
        dueDate: true,
        status: true,
        reference: true,
      },
    });

    const now = new Date();
    const byCurrency = new Map<
      string,
      { totalOutstanding: Prisma.Decimal; overdueOutstanding: Prisma.Decimal }
    >();
    const rows: SalesCustomerDetailReceivableRow[] = [];

    for (const receivable of rawReceivables) {
      const outstanding = receivable.amount.minus(receivable.paidAmount);
      if (outstanding.lte(0)) continue;

      const bucket = byCurrency.get(receivable.currency) ?? {
        totalOutstanding: new Prisma.Decimal(0),
        overdueOutstanding: new Prisma.Decimal(0),
      };

      bucket.totalOutstanding = bucket.totalOutstanding.plus(outstanding);

      const isOverdue = receivable.dueDate !== null && receivable.dueDate < now;
      if (isOverdue) {
        bucket.overdueOutstanding = bucket.overdueOutstanding.plus(outstanding);
      }

      byCurrency.set(receivable.currency, bucket);

      rows.push({
        id: receivable.id,
        salesOrderId: receivable.salesOrderId,
        amount: decimalToString(receivable.amount),
        paidAmount: decimalToString(receivable.paidAmount),
        outstanding: decimalToString(outstanding),
        currency: receivable.currency,
        dueDate: receivable.dueDate?.toISOString() ?? null,
        status: receivable.status,
        reference: receivable.reference,
      });
    }

    rows.sort((a, b) => {
      if (a.dueDate === null) return b.dueDate === null ? 0 : 1;
      if (b.dueDate === null) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

    receivables = Array.from(byCurrency.entries())
      .map(([currency, bucket]) => ({
        currency,
        totalOutstanding: decimalToString(bucket.totalOutstanding),
        overdueOutstanding: decimalToString(bucket.overdueOutstanding),
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency));
    receivableDetails = rows;
  }

  return {
    id: customer.id,
    code: customer.code,
    name: customer.name,
    status: customer.status,
    legalName: customer.legalName,
    taxId: customer.taxId,
    contactPerson: customer.contactPerson,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    country: customer.country,
    creditLimit: customer.creditLimit ? decimalToString(customer.creditLimit) : null,
    paymentTermDays: customer.paymentTermDays,
    lastContactAt: customer.lastContactAt?.toISOString() ?? null,
    lastPurchaseAt: customer.lastPurchaseAt?.toISOString() ?? null,
    nextActionAt: customer.nextActionAt?.toISOString() ?? null,
    notes: customer.notes,
    recentOrders,
    receivables,
    receivableDetails,
  };
}
