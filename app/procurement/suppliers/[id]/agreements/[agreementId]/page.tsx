import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SupplierAgreementDetailView } from "@/components/procurement/supplier-agreement-detail";
import { SupplierDetailHeader } from "@/components/procurement/supplier-detail-header";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getSupplierAgreementDetail } from "@/lib/services/procurement/get-supplier-agreement-detail";
import { getSupplierDetail } from "@/lib/services/procurement/get-supplier-detail";
import { getBusinessDate } from "@/lib/services/procurement/supplier-agreement-display-status";

const PROCUREMENT_OVERVIEW_PERMISSION = "procurement.overview.read";
const SUPPLIERS_READ_PERMISSION = "suppliers.read";

/**
 * Read-only card of one supplier agreement, inside its supplier's card
 * ("Agreements" tab stays active). Same access as the supplier card. An
 * unknown supplier, an unknown agreement and another supplier's agreement
 * all resolve to the same notFound() — the agreement is looked up by id
 * AND supplierId together.
 */
export default async function SupplierAgreementDetailPage(
  props: PageProps<"/procurement/suppliers/[id]/agreements/[agreementId]">,
) {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    // Same reasoning as every other workspace route: any failure here is
    // safest resolved by "/", which re-derives the correct destination.
    user = await requirePermission(PROCUREMENT_OVERVIEW_PERMISSION);
  } catch {
    redirect("/");
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);

  if (!permissionCodes.includes(SUPPLIERS_READ_PERMISSION)) {
    redirect("/");
  }

  const locale = await getCurrentLocale();
  const dictionary = getDictionary(locale);

  const { id, agreementId } = await props.params;
  const supplier = await getSupplierDetail(id);

  if (!supplier) {
    notFound();
  }

  const agreement = await getSupplierAgreementDetail({
    supplierId: supplier.id,
    agreementId,
    businessDate: getBusinessDate(new Date()),
  });

  if (!agreement) {
    notFound();
  }

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath={`/procurement/suppliers/${supplier.id}/agreements/${agreement.id}`}
      dictionary={dictionary}
      showPeriodControl={false}
      showGlobalSearch={false}
    >
      <SupplierDetailHeader supplier={supplier} activeTab="agreements" dictionary={dictionary} />

      <Link
        href={`/procurement/suppliers/${supplier.id}/agreements`}
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
        {dictionary.procurement.supplierDetail.agreementDetail.backToAgreements}
      </Link>

      <SupplierAgreementDetailView agreement={agreement} locale={locale} dictionary={dictionary} />
    </DashboardShell>
  );
}
