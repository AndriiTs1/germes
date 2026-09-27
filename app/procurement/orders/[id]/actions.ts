"use server";

import { revalidatePath } from "next/cache";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { requirePermission } from "@/lib/permissions/require-permission";
import {
  transitionPurchaseOrderStatus,
  type PurchaseOrderTransition,
  type TransitionPurchaseOrderError,
} from "@/lib/services/procurement/transition-purchase-order-status";

const PROCUREMENT_ORDERS_UPDATE_PERMISSION = "procurement.orders.update";

/**
 * Mutation boundary for the lifecycle transitions — same shape as the Sales
 * order actions. requirePermission is re-checked here regardless of what
 * the page rendered; the service enforces which transitions are allowed.
 */
async function runTransition(
  purchaseOrderId: string,
  transition: PurchaseOrderTransition,
): Promise<{ error: string } | void> {
  const locale = await getCurrentLocale();
  const t = getDictionary(locale).procurement.orderActions;

  const user = await requirePermission(PROCUREMENT_ORDERS_UPDATE_PERMISSION).catch(() => null);

  if (!user) {
    return { error: t.transitionGenericError };
  }

  const result = await transitionPurchaseOrderStatus(user.id, purchaseOrderId, transition);

  if (!result.ok) {
    const messages: Record<TransitionPurchaseOrderError, string> = {
      INVALID_TRANSITION: t.invalidTransition,
      STATUS_CHANGED: t.statusChanged,
      SUPPLIER_NOT_ACTIVE: t.supplierNotActive,
      WAREHOUSE_UNAVAILABLE: t.warehouseUnavailable,
      PRODUCT_UNAVAILABLE: t.productUnavailable,
      TRANSITION_FAILED: t.transitionGenericError,
    };
    return { error: messages[result.error] };
  }

  revalidatePath("/procurement");
  revalidatePath("/procurement/orders");
  revalidatePath(`/procurement/orders/${purchaseOrderId}`);
}

export async function confirmPurchaseOrderAction(purchaseOrderId: string): Promise<{ error: string } | void> {
  return runTransition(purchaseOrderId, "CONFIRM");
}

export async function cancelPurchaseOrderAction(purchaseOrderId: string): Promise<{ error: string } | void> {
  return runTransition(purchaseOrderId, "CANCEL");
}
