"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { requirePermission } from "@/lib/permissions/require-permission";
import { createSalesOrder } from "@/lib/services/sales/create-sales-order";
import {
  createSalesOrderSchema,
  type CreateSalesOrderFormValues,
} from "@/lib/validation/sales-order";

const SALES_ORDERS_CREATE_PERMISSION = "sales.orders.create";

/**
 * The mutation boundary. Never relies on the page having already gated
 * access — requirePermission is called again here, independently, exactly
 * as every other write-adjacent piece of this codebase does. Re-validates
 * with the same Zod schema the client used (never trusts that client-side
 * validation actually ran). Never accepts status/responsibleId/
 * orderNumber/total/currency from the caller — createSalesOrderSchema has
 * no such fields, and createSalesOrder sets all of them itself.
 */
export async function createSalesOrderAction(
  input: CreateSalesOrderFormValues,
): Promise<{ error: string } | void> {
  const locale = await getCurrentLocale();
  const t = getDictionary(locale).orderActions;

  const user = await requirePermission(SALES_ORDERS_CREATE_PERMISSION).catch(() => null);

  if (!user) {
    return { error: t.createGenericError };
  }

  const parsed = createSalesOrderSchema.safeParse(input);

  if (!parsed.success) {
    return { error: t.createGenericError };
  }

  const result = await createSalesOrder(user.id, parsed.data);

  if (!result.ok) {
    if (result.error === "CUSTOMER_UNAVAILABLE") {
      return { error: t.customerUnavailable };
    }
    if (result.error === "PRODUCT_UNAVAILABLE") {
      return { error: t.productUnavailable };
    }
    return { error: t.createGenericError };
  }

  revalidatePath("/sales");
  revalidatePath("/sales/orders");
  revalidatePath("/sales/customers");
  revalidatePath(`/sales/customers/${parsed.data.customerId}`);

  redirect(`/sales/orders/${result.orderId}`);
}
