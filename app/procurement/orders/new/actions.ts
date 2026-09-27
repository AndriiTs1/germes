"use server";

import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { requirePermission } from "@/lib/permissions/require-permission";
import {
  createPurchaseOrder,
  type CreatePurchaseOrderError,
} from "@/lib/services/procurement/create-purchase-order";
import {
  createPurchaseOrderSchema,
  type CreatePurchaseOrderFormValues,
} from "@/lib/validation/purchase-order";

const PROCUREMENT_ORDERS_CREATE_PERMISSION = "procurement.orders.create";

/**
 * The mutation boundary, same shape as createSalesOrderAction.
 * requirePermission is called here independently of any page gate, and
 * the input is re-validated with the same Zod schema the client uses.
 * createdById comes only from the authenticated user; id, orderNumber,
 * status and orderDate are not part of the schema and are set by
 * createPurchaseOrder itself.
 *
 * No revalidatePath yet: nothing currently rendered depends on
 * PurchaseOrder rows except the detail page this action redirects to.
 * Invalidation is added together with the orders list / PO-based
 * procurement overview.
 */
export async function createPurchaseOrderAction(
  input: CreatePurchaseOrderFormValues,
): Promise<{ error: string } | void> {
  const locale = await getCurrentLocale();
  const t = getDictionary(locale).procurement.orderActions;

  const user = await requirePermission(PROCUREMENT_ORDERS_CREATE_PERMISSION).catch(() => null);

  if (!user) {
    return { error: t.createGenericError };
  }

  const parsed = createPurchaseOrderSchema.safeParse(input);

  if (!parsed.success) {
    return { error: t.createGenericError };
  }

  const result = await createPurchaseOrder(user.id, parsed.data);

  if (!result.ok) {
    const messages: Record<CreatePurchaseOrderError, string> = {
      SUPPLIER_UNAVAILABLE: t.supplierUnavailable,
      WAREHOUSE_UNAVAILABLE: t.warehouseUnavailable,
      PRODUCT_UNAVAILABLE: t.productUnavailable,
      CREATE_FAILED: t.createGenericError,
    };
    return { error: messages[result.error] };
  }

  redirect(`/procurement/orders/${result.purchaseOrderId}`);
}
