"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/permissions/require-permission";
import {
  transitionSalesOrderStatus,
  type SalesOrderTransition,
} from "@/lib/services/sales/transition-sales-order-status";

const SALES_ORDERS_UPDATE_PERMISSION = "sales.orders.update";
const GENERIC_TRANSITION_ERROR = "Could not update the order. Please try again.";

/**
 * Shared mutation boundary for both lifecycle actions. Never relies on the
 * page having already gated access — requirePermission is called again
 * here, independently, exactly as createSalesOrderAction already does.
 * `transition` is always one of the two literal values named by the
 * exported functions below — never taken from arbitrary client input, so
 * there is no way to request an unsupported destination status through
 * this boundary. The current status is read fresh from the database
 * inside transitionSalesOrderStatus itself, never trusted from the
 * caller.
 */
async function runOrderTransition(
  orderId: string,
  transition: SalesOrderTransition,
): Promise<{ error: string } | void> {
  const user = await requirePermission(SALES_ORDERS_UPDATE_PERMISSION).catch(() => null);

  if (!user) {
    return { error: GENERIC_TRANSITION_ERROR };
  }

  const result = await transitionSalesOrderStatus(user.id, orderId, transition);

  if (!result.ok) {
    return { error: GENERIC_TRANSITION_ERROR };
  }

  // Minimum correct set: the workspace summary and the orders list both
  // read order status (active-order counts, status filters/badges), the
  // detail page itself must reflect the new status/available actions, and
  // the affected customer's own pages show data derived from this same
  // order's status (activeOrdersCount on the list, this order's status
  // badge in "Recent Orders" on the detail page) — revalidated
  // unconditionally on every successful transition rather than only when
  // a terminal status is involved, since that conditional would add
  // complexity without any real benefit (revalidation is cheap).
  revalidatePath("/sales");
  revalidatePath("/sales/orders");
  revalidatePath(`/sales/orders/${orderId}`);
  revalidatePath("/sales/customers");
  revalidatePath(`/sales/customers/${result.customerId}`);
}

export async function confirmSalesOrderAction(orderId: string): Promise<{ error: string } | void> {
  return runOrderTransition(orderId, "CONFIRM");
}

export async function cancelSalesOrderAction(orderId: string): Promise<{ error: string } | void> {
  return runOrderTransition(orderId, "CANCEL");
}
