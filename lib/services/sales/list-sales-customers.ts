import { Prisma, type CustomerStatus, FinanceStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToString } from "@/lib/services/sales/decimal";
import { TERMINAL_SALES_ORDER_STATUSES } from "@/lib/services/sales/config";
import type { SalesReadScope } from "@/lib/services/sales/read-scope";

export type CustomerReceivableSummary = {
  currency: string;
  totalOutstanding: string;
  overdueOutstanding: string;
};

export type SalesCustomerListItem = {
  id: string;
  code: string;
  name: string;
  status: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  lastContactAt: string | null;
  lastPurchaseAt: string | null;
  nextActionAt: string | null;
  creditLimit: string | null;
  paymentTermDays: number;
  /** Orders whose status is NOT IN TERMINAL_SALES_ORDER_STATUSES — same shared definition as Orders. */
  activeOrdersCount: number;
  /** Grouped by currency, never summed across currencies. Empty array = no outstanding receivables. */
  receivables: CustomerReceivableSummary[];
};

export type ListSalesCustomersOptions = {
  /**
   * Read visibility. Defaults to "own" so every existing caller preserves
   * salesperson isolation unless it explicitly opts into supervisory reads.
   */
  scope?: SalesReadScope;
  /** Matches name, code, phone, or email — case-insensitive where meaningful, via Prisma. */
  search?: string;
  /** Exact CustomerStatus filter. Omitted/undefined = all statuses. */
  status?: CustomerStatus;
  /** 1-indexed page. Defaults to 1. */
  page?: number;
  /** Page size. Defaults to 20. */
  limit?: number;
};

export type ListSalesCustomersResult = {
  items: SalesCustomerListItem[];
  totalCount: number;
  page: number;
  pageCount: number;
};

/**
 * Customers visible in the requested read scope. The default "own" scope
 * is exactly as before (Stage 8C): responsibleId + isActive: true as the
 * base scope; "all" drops only the responsibleId condition and is reserved
 * for a caller that has already resolved supervisory visibility. A status
 * filter narrows further but never bypasses isActive — an isActive:false
 * customer never appears regardless of status or scope.
 *
 * Read-only CRM fields only — credit limit/payment terms are included
 * since SALES has customers.read (viewing is fine; only
 * customers.credit_limit.update, which SALES lacks, would let anyone
 * change them).
 *
 * One customer query (with a filtered relation _count for active orders)
 * plus one batched receivables query for all returned customer IDs —
 * never a query per customer. Receivable aggregation reuses the exact
 * rules already established in getReceivableExposure: excludes PAID/
 * CANCELLED, outstanding = amount - paidAmount, overdue derived from
 * dueDate vs now, grouped by currency, never summed across currencies.
 *
 * lastPurchaseAt is Customer's own stored field — deliberately NOT
 * derived from SalesOrder history. Live data shows a real discrepancy
 * between this stored value and "most recent COMPLETED order" for at
 * least one seeded customer; per the completed architecture inspection,
 * the stored field remains the single V1 source of truth rather than
 * introducing a second, differently-computed definition.
 */
export async function listSalesCustomers(
  currentUserId: string,
  options: ListSalesCustomersOptions = {},
): Promise<ListSalesCustomersResult> {
  const { scope = "own", search, status, page: rawPage, limit = 20 } = options;

  const trimmedSearch = search?.trim();
  const page = rawPage && rawPage > 0 ? Math.floor(rawPage) : 1;

  const where: Prisma.CustomerWhereInput = {
    responsibleId: scope === "all" ? undefined : currentUserId,
    isActive: true,
    status: status ?? undefined,
    OR: trimmedSearch
      ? [
          { name: { contains: trimmedSearch, mode: "insensitive" } },
          { code: { contains: trimmedSearch, mode: "insensitive" } },
          { phone: { contains: trimmedSearch } },
          { email: { contains: trimmedSearch, mode: "insensitive" } },
        ]
      : undefined,
  };

  const [customers, totalCount] = await Promise.all([
    prisma.customer.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        contactPerson: true,
        phone: true,
        email: true,
        lastContactAt: true,
        lastPurchaseAt: true,
        nextActionAt: true,
        creditLimit: true,
        paymentTermDays: true,
        _count: {
          select: {
            salesOrders: { where: { status: { notIn: TERMINAL_SALES_ORDER_STATUSES } } },
          },
        },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.customer.count({ where }),
  ]);

  const customerIds = customers.map((customer) => customer.id);

  const receivables =
    customerIds.length > 0
      ? await prisma.receivable.findMany({
          where: {
            customerId: { in: customerIds },
            status: { notIn: [FinanceStatus.PAID, FinanceStatus.CANCELLED] },
          },
          select: {
            customerId: true,
            currency: true,
            amount: true,
            paidAmount: true,
            dueDate: true,
          },
        })
      : [];

  const now = new Date();
  const receivablesByCustomer = new Map<
    string,
    Map<string, { totalOutstanding: Prisma.Decimal; overdueOutstanding: Prisma.Decimal }>
  >();

  for (const receivable of receivables) {
    const outstanding = receivable.amount.minus(receivable.paidAmount);
    if (outstanding.lte(0)) continue;

    const byCurrency =
      receivablesByCustomer.get(receivable.customerId) ??
      new Map<string, { totalOutstanding: Prisma.Decimal; overdueOutstanding: Prisma.Decimal }>();

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
    receivablesByCustomer.set(receivable.customerId, byCurrency);
  }

  const items: SalesCustomerListItem[] = customers.map((customer) => {
    const byCurrency = receivablesByCustomer.get(customer.id);
    const receivableSummaries: CustomerReceivableSummary[] = byCurrency
      ? Array.from(byCurrency.entries())
          .map(([currency, bucket]) => ({
            currency,
            totalOutstanding: decimalToString(bucket.totalOutstanding),
            overdueOutstanding: decimalToString(bucket.overdueOutstanding),
          }))
          .sort((a, b) => a.currency.localeCompare(b.currency))
      : [];

    return {
      id: customer.id,
      code: customer.code,
      name: customer.name,
      status: customer.status,
      contactPerson: customer.contactPerson,
      phone: customer.phone,
      email: customer.email,
      lastContactAt: customer.lastContactAt?.toISOString() ?? null,
      lastPurchaseAt: customer.lastPurchaseAt?.toISOString() ?? null,
      nextActionAt: customer.nextActionAt?.toISOString() ?? null,
      creditLimit: customer.creditLimit ? decimalToString(customer.creditLimit) : null,
      paymentTermDays: customer.paymentTermDays,
      activeOrdersCount: customer._count.salesOrders,
      receivables: receivableSummaries,
    };
  });

  return {
    items,
    totalCount,
    page,
    pageCount: Math.max(1, Math.ceil(totalCount / limit)),
  };
}
