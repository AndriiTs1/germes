import { Prisma, type SalesOrderStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToString } from "@/lib/services/sales/decimal";
import { TERMINAL_SALES_ORDER_STATUSES } from "@/lib/services/sales/config";

export type SalesOrderListItem = {
  id: string;
  orderNumber: string;
  status: string;
  orderDate: string;
  requestedDate: string | null;
  shippedAt: string | null;
  customerId: string;
  customerName: string;
  currency: string;
  totalValue: string;
  totalQuantityKg: string;
  itemCount: number;
};

export type ListSalesOrdersOptions = {
  /** Page size. Defaults to 20. */
  limit?: number;
  /** SalesOrder.id to resume after — simple cursor pagination. Ignored when `page` is set. */
  cursor?: string;
  /** 1-indexed offset pagination — simpler to reflect in a URL than cursor. Takes precedence over `cursor`. */
  page?: number;
  /** Excludes SHIPPED/COMPLETED/CANCELLED when true. Ignored when `status` is set. */
  onlyActive?: boolean;
  /** Exact status filter (e.g. COMPLETED, CANCELLED). Takes precedence over `onlyActive`. */
  status?: SalesOrderStatus;
  /** Matches orderNumber OR customer.name, case-insensitive, via Prisma — never filtered in JS. */
  search?: string;
};

export type ListSalesOrdersResult = {
  orders: SalesOrderListItem[];
  nextCursor: string | null;
  /**
   * True count of orders matching the same where-clause (via a separate
   * count() query, not orders.length) — the page slice above is limited,
   * so its length would undercount whenever there are more matching rows
   * than the requested page size.
   */
  totalCount: number;
  /** 1-indexed current page (always 1 when using cursor-based pagination). */
  page: number;
  /** Total number of pages of size `limit`, at least 1. */
  pageCount: number;
};

/**
 * Sales orders owned by currentUserId (SalesOrder.responsibleId), most
 * recent first. Total value is not stored on SalesOrder, so it is derived
 * from SalesOrderItem (quantityKg * pricePerKg) using Prisma.Decimal
 * arithmetic — never JS floating point.
 *
 * All existing callers (onlyActive/cursor/limit only) keep working exactly
 * as before — `status`/`search`/`page` are purely additive.
 */
export async function listSalesOrders(
  currentUserId: string,
  options: ListSalesOrdersOptions = {},
): Promise<ListSalesOrdersResult> {
  const { limit = 20, cursor, page, onlyActive = false, status, search } = options;

  const trimmedSearch = search?.trim();
  const usePageMode = page !== undefined;
  const currentPage = usePageMode && page! > 0 ? Math.floor(page!) : 1;

  const where: Prisma.SalesOrderWhereInput = {
    responsibleId: currentUserId,
    status: status ?? (onlyActive ? { notIn: TERMINAL_SALES_ORDER_STATUSES } : undefined),
    OR: trimmedSearch
      ? [
          { orderNumber: { contains: trimmedSearch, mode: "insensitive" } },
          { customer: { name: { contains: trimmedSearch, mode: "insensitive" } } },
        ]
      : undefined,
  };

  // Every key below is always present with a plain value (never a
  // conditionally-spread key) — a conditional spread here previously broke
  // TypeScript's inference of the `select` shape (see Stage 8C history).
  const take = usePageMode ? limit : limit + 1;
  const skip = usePageMode ? (currentPage - 1) * limit : cursor ? 1 : undefined;
  const cursorArg = usePageMode || !cursor ? undefined : { id: cursor };

  const [orders, totalCount] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        orderDate: true,
        requestedDate: true,
        shippedAt: true,
        currency: true,
        customer: { select: { id: true, name: true } },
        items: { select: { quantityKg: true, pricePerKg: true } },
      },
      orderBy: { orderDate: "desc" },
      take,
      skip,
      cursor: cursorArg,
    }),
    prisma.salesOrder.count({ where }),
  ]);

  const hasMoreViaCursor = !usePageMode && orders.length > limit;
  const pageRows = hasMoreViaCursor ? orders.slice(0, limit) : orders;

  const items: SalesOrderListItem[] = pageRows.map((order) => {
    let totalValue = new Prisma.Decimal(0);
    let totalQuantityKg = new Prisma.Decimal(0);

    for (const item of order.items) {
      totalValue = totalValue.plus(item.quantityKg.times(item.pricePerKg));
      totalQuantityKg = totalQuantityKg.plus(item.quantityKg);
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      orderDate: order.orderDate.toISOString(),
      requestedDate: order.requestedDate?.toISOString() ?? null,
      shippedAt: order.shippedAt?.toISOString() ?? null,
      customerId: order.customer.id,
      customerName: order.customer.name,
      currency: order.currency,
      totalValue: decimalToString(totalValue),
      totalQuantityKg: decimalToString(totalQuantityKg),
      itemCount: order.items.length,
    };
  });

  return {
    orders: items,
    nextCursor: hasMoreViaCursor ? pageRows[pageRows.length - 1].id : null,
    totalCount,
    page: currentPage,
    pageCount: Math.max(1, Math.ceil(totalCount / limit)),
  };
}
