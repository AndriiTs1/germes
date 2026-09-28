"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupplierAgreementHref } from "@/components/procurement/supplier-agreement-format";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { requirePermission } from "@/lib/permissions/require-permission";
import {
  createSupplierAgreement,
  type CreateSupplierAgreementError,
} from "@/lib/services/procurement/create-supplier-agreement";
import {
  supplierAgreementFormSchema,
  type SupplierAgreementFormValues,
} from "@/lib/validation/supplier-agreement";

const SUPPLIERS_UPDATE_PERMISSION = "suppliers.update";

export type CreateSupplierAgreementActionResult = {
  error: string;
  /** Set when the error belongs to one form field (shown next to it). */
  field?: "agreementNumber";
};

/**
 * Mutation boundary for creating a DRAFT agreement, same shape as
 * createPurchaseOrderAction: requirePermission is checked here
 * independently of the page gate, and the raw form values are re-parsed
 * with the same schema the form uses. supplierId is the route's supplier
 * (an explicit argument, never a form field); status, createdById and
 * incotermVersion are set by the schema/service, never taken from input.
 */
export async function createSupplierAgreementAction(
  supplierId: string,
  input: SupplierAgreementFormValues,
): Promise<CreateSupplierAgreementActionResult | void> {
  const locale = await getCurrentLocale();
  const t = getDictionary(locale).procurement.supplierDetail.agreementForm;

  const user = await requirePermission(SUPPLIERS_UPDATE_PERMISSION).catch(() => null);

  if (!user) {
    return { error: t.createGenericError };
  }

  const parsed = supplierAgreementFormSchema.safeParse(input);

  if (!parsed.success) {
    return { error: t.invalidForm };
  }

  const result = await createSupplierAgreement(user.id, supplierId, parsed.data);

  if (!result.ok) {
    const messages: Record<CreateSupplierAgreementError, CreateSupplierAgreementActionResult> = {
      SUPPLIER_NOT_FOUND: { error: t.supplierNotFound },
      DUPLICATE_AGREEMENT_NUMBER: { error: t.duplicateAgreementNumber, field: "agreementNumber" },
      CREATE_FAILED: { error: t.createGenericError },
    };
    return messages[result.error];
  }

  revalidatePath(`/procurement/suppliers/${supplierId}/agreements`);
  redirect(getSupplierAgreementHref(supplierId, result.agreementId));
}
