"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { requirePermission } from "@/lib/permissions/require-permission";
import {
  updatePurchaseOrder,
  type UpdatePurchaseOrderError,
} from "@/lib/services/procurement/update-purchase-order";
import {
  createPurchaseOrderSchema,
  type CreatePurchaseOrderFormValues,
} from "@/lib/validation/purchase-order";

const PROCUREMENT_ORDERS_UPDATE_PERMISSION = "procurement.orders.update";

/**
 * Mutation boundary for editing a DRAFT — same shape as
 * updateSalesOrderAction. Re-checks the permission and re-validates with
 * the create schema (the same business fields). orderId and loadedUpdatedAt
 * are routing/concurrency metadata, not form data; status, orderNumber,
 * createdBy and orderDate are never accepted and never written.
 */
export async function updatePurchaseOrderAction(
  purchaseOrderId: string,
  loadedUpdatedAt: string,
  input: CreatePurchaseOrderFormValues,
): Promise<{ error: string } | void> {
  const locale = await getCurrentLocale();
  const t = getDictionary(locale).procurement.orderActions;

  const user = await requirePermission(PROCUREMENT_ORDERS_UPDATE_PERMISSION).catch(() => null);

  if (!user) {
    return { error: t.saveGenericError };
  }

  const parsed = createPurchaseOrderSchema.safeParse(input);

  if (!parsed.success) {
    return { error: t.saveGenericError };
  }

  const result = await updatePurchaseOrder(user.id, purchaseOrderId, loadedUpdatedAt, parsed.data);

  if (!result.ok) {
    const messages: Record<UpdatePurchaseOrderError, string> = {
      ORDER_NOT_EDITABLE: t.orderNotEditable,
      STALE_EDIT: t.staleEdit,
      SUPPLIER_UNAVAILABLE: t.supplierUnavailable,
      WAREHOUSE_UNAVAILABLE: t.warehouseUnavailable,
      PRODUCT_UNAVAILABLE: t.productUnavailable,
      UPDATE_FAILED: t.saveGenericError,
    };
    return { error: messages[result.error] };
  }

  revalidatePath("/procurement");
  revalidatePath("/procurement/orders");
  revalidatePath(`/procurement/orders/${purchaseOrderId}`);

  redirect(`/procurement/orders/${purchaseOrderId}`);
}
