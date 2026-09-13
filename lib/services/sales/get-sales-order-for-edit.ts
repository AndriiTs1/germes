import { SalesOrderStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToString } from "@/lib/services/sales/decimal";

export type SalesOrderEditItem = {
  /** Present only to give the edit form a stable React key — never used to target an update; items are always replaced wholesale (see updateSalesOrder). */
  id: string;
  productId: string;
  quantityKg: string;
  pricePerKg: string;
};

export type SalesOrderForEdit = {
  id: string;
  orderNumber: string;
  customerId: string;
  requestedDate: string | null;
  currency: string;
  notes: string | null;
  /** ISO string — the edit form must round-trip this back unchanged as the optimistic-concurrency token (see updateSalesOrder). */
  updatedAt: string;
  items: SalesOrderEditItem[];
};

/**
 * Full data needed to populate the (future) Edit Order form for exactly
 * one order owned by currentUserId and currently in DRAFT.
 *
 * No auth/Supabase/permission/role logic here — same convention as
 * getSalesOrderDetail/getSalesCustomerDetail: the caller (a future page or
 * server action) is responsible for requirePermission("sales.orders.update")
 * before calling this. This function only enforces row-scoping + the
 * DRAFT-only editability rule, via one findFirst — nonexistent, foreign,
 * and non-DRAFT orders are all indistinguishable, resolving to the same
 * null. No role.code, no OWNER bypass.
 */
export async function getSalesOrderForEdit(
  currentUserId: string,
  orderId: string,
): Promise<SalesOrderForEdit | null> {
  const order = await prisma.salesOrder.findFirst({
    where: { id: orderId, responsibleId: currentUserId, status: SalesOrderStatus.DRAFT },
    select: {
      id: true,
      orderNumber: true,
      customerId: true,
      requestedDate: true,
      currency: true,
      notes: true,
      updatedAt: true,
      items: {
        select: {
          id: true,
          productId: true,
          quantityKg: true,
          pricePerKg: true,
        },
      },
    },
  });

  if (!order) return null;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    requestedDate: order.requestedDate?.toISOString() ?? null,
    currency: order.currency,
    notes: order.notes,
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantityKg: decimalToString(item.quantityKg),
      pricePerKg: decimalToString(item.pricePerKg),
    })),
  };
}
