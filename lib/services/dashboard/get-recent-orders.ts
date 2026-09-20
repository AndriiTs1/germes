import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type RecentOrderData = {
  id: string;
  customer: string;
  amount: string;
  currency: string;
  orderDate: Date;
  isToday: boolean;
  time: string;
};

export async function getRecentOrders(): Promise<RecentOrderData[]> {
  const orders = await prisma.salesOrder.findMany({
    take: 5,
    orderBy: {
      orderDate: "desc",
    },
    select: {
      orderNumber: true,
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

  const today = new Date();

  return orders.map((order) => {
    const total = order.items.reduce(
      (sum, item) =>
        sum.plus(item.quantityKg.mul(item.pricePerKg)),
      new Prisma.Decimal(0),
    );

    return {
      id: order.orderNumber,
      customer: order.customer.name,
      amount: `${total.toString()} ${order.currency}`,
      currency: order.currency,
      orderDate: order.orderDate,
      isToday:
        order.orderDate.toDateString() === today.toDateString(),
      time: order.orderDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  });
}
