import { Prisma } from "@/lib/generated/prisma/client";
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
  /** SalesOrder.id to resume after — simple cursor pagination. */
  cursor?: string;
  /** Excludes COMPLETED/CANCELLED when true. */
  onlyActive?: boolean;
};

export type ListSalesOrdersResult = {
  orders: SalesOrderListItem[];
  nextCursor: string | null;
};

/**
 * Sales orders owned by currentUserId (SalesOrder.responsibleId), most
 * recent first. Total value is not stored on SalesOrder, so it is derived
 * from SalesOrderItem (quantityKg * pricePerKg) using Prisma.Decimal
 * arithmetic — never JS floating point.
 */
export async function listSalesOrders(
  currentUserId: string,
  options: ListSalesOrdersOptions = {},
): Promise<ListSalesOrdersResult> {
  const { limit = 20, cursor, onlyActive = false } = options;

  const orders = await prisma.salesOrder.findMany({
    where: {
      responsibleId: currentUserId,
      status: onlyActive ? { notIn: TERMINAL_SALES_ORDER_STATUSES } : undefined,
    },
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
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : undefined,
  });

  const hasMore = orders.length > limit;
  const page = hasMore ? orders.slice(0, limit) : orders;

  const items: SalesOrderListItem[] = page.map((order) => {
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
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}
