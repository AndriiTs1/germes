"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { requirePermission } from "@/lib/permissions/require-permission";
import { updateSalesOrder } from "@/lib/services/sales/update-sales-order";
import {
  createSalesOrderSchema,
  type CreateSalesOrderFormValues,
} from "@/lib/validation/sales-order";

const SALES_ORDERS_UPDATE_PERMISSION = "sales.orders.update";

/**
 * The mutation boundary. Never relies on the page having already gated
 * access — requirePermission is called again here, independently, exactly
 * as createSalesOrderAction does. Re-validates with the same Zod schema the
 * client used (never trusts that client-side validation actually ran).
 * Never accepts responsibleId/status/currency/orderNumber from the caller —
 * createSalesOrderSchema has no such fields, and updateSalesOrder never
 * touches them either way.
 *
 * orderId and loadedUpdatedAt are taken as separate arguments (not part of
 * `input`) — they are concurrency/routing metadata, not business-editable
 * form data, and stay outside the RHF-managed/Zod-validated object exactly
 * as the approved audit specified.
 */
export async function updateSalesOrderAction(
  orderId: string,
  loadedUpdatedAt: string,
  input: CreateSalesOrderFormValues,
): Promise<{ error: string } | void> {
  const locale = await getCurrentLocale();
  const t = getDictionary(locale).orderActions;

  const user = await requirePermission(SALES_ORDERS_UPDATE_PERMISSION).catch(() => null);

  if (!user) {
    return { error: t.saveGenericError };
  }

  const parsed = createSalesOrderSchema.safeParse(input);

  if (!parsed.success) {
    return { error: t.saveGenericError };
  }

  const result = await updateSalesOrder(user.id, orderId, loadedUpdatedAt, parsed.data);

  if (!result.ok) {
    if (result.error === "ORDER_NOT_EDITABLE") {
      return { error: t.orderNotEditable };
    }
    if (result.error === "STALE_EDIT") {
      return { error: t.staleEdit };
    }
    if (result.error === "CUSTOMER_UNAVAILABLE") {
      return { error: t.customerUnavailable };
    }
    if (result.error === "PRODUCT_UNAVAILABLE") {
      return { error: t.productUnavailable };
    }
    return { error: t.saveGenericError };
  }

  revalidatePath("/sales");
  revalidatePath("/sales/orders");
  revalidatePath(`/sales/orders/${orderId}`);
  revalidatePath("/sales/customers");
  revalidatePath(`/sales/customers/${parsed.data.customerId}`);

  if (result.previousCustomerId !== parsed.data.customerId) {
    revalidatePath(`/sales/customers/${result.previousCustomerId}`);
  }

  redirect(`/sales/orders/${orderId}`);
}
