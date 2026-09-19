"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { requirePermission } from "@/lib/permissions/require-permission";
import { registerReceivablePayment } from "@/lib/services/finance/register-receivable-payment";

const RECEIVABLES_UPDATE_PERMISSION = "finance.receivables.update";

const registerPaymentSchema = z.object({
  orderId: z.string().uuid(),
  receivableId: z.string().uuid(),
  amount: z
    .string()
    .trim()
    .regex(/^\d+([.,]\d{1,2})?$/),
});

export type RegisterPaymentActionState = {
  ok: boolean;
  message: string | null;
};

export async function registerReceivablePaymentAction(
  _previousState: RegisterPaymentActionState,
  formData: FormData,
): Promise<RegisterPaymentActionState> {
  const locale = await getCurrentLocale();
  const t = getDictionary(locale).orderDetail.receivable;

  const user = await requirePermission(
    RECEIVABLES_UPDATE_PERMISSION,
  ).catch(() => null);

  if (!user) {
    return {
      ok: false,
      message: t.paymentNoPermission,
    };
  }

  const parsed = registerPaymentSchema.safeParse({
    orderId: formData.get("orderId"),
    receivableId: formData.get("receivableId"),
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: t.paymentInvalidAmount,
    };
  }

  const result = await registerReceivablePayment(user.id, {
    receivableId: parsed.data.receivableId,
    amount: parsed.data.amount.replace(",", "."),
  });

  if (!result.ok) {
    const message =
      result.error === "OVERPAYMENT"
        ? t.paymentOverpayment
        : result.error === "INVALID_AMOUNT"
          ? t.paymentInvalidAmount
          : result.error === "RECEIVABLE_UNAVAILABLE"
            ? t.paymentUnavailable
            : t.paymentFailed;

    return {
      ok: false,
      message,
    };
  }

  revalidatePath("/sales");
  revalidatePath("/sales/orders");
  revalidatePath(`/sales/orders/${parsed.data.orderId}`);
  revalidatePath("/sales/customers");

  return {
    ok: true,
    message: t.paymentSuccess,
  };
}
