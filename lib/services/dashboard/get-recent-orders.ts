import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const RECENT_ORDERS_LIMIT = 5;

export type RecentOrderData = {
  id: string;
  orderNumber: string;
  customer: string;
  /** Σ quantityKg × pricePerKg (Decimal string), in the order's own currency. */
  amount: string;
  currency: string;
  /** Real SalesOrder status — every status is shown, none hidden. */
  status: string;
  /** Full instant (ISO); the card shows it in Europe/Kyiv. */
  orderDate: string;
};

/**
 * The latest sales orders of any status, newest orderDate first; id breaks
 * ties so the list never depends on database row order.
 */
export async function getRecentOrders(): Promise<RecentOrderData[]> {
  const orders = await prisma.salesOrder.findMany({
    take: RECENT_ORDERS_LIMIT,
    orderBy: [{ orderDate: "desc" }, { id: "desc" }],
    select: {
      id: true,
      orderNumber: true,
      status: true,
      orderDate: true,
      currency: true,
      customer: {
        select: {
          name: true,
        },
      },
      items: {
        select: {
          quantityKg: true,
          pricePerKg: true,
        },
      },
    },
  });

  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    customer: order.customer.name,
    amount: order.items
      .reduce((sum, item) => sum.plus(item.quantityKg.mul(item.pricePerKg)), new Prisma.Decimal(0))
      .toString(),
    currency: order.currency,
    status: order.status,
    orderDate: order.orderDate.toISOString(),
  }));
}
