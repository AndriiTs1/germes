import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SupplierAgreementForm } from "@/components/procurement/supplier-agreement-form";
import { SupplierDetailHeader } from "@/components/procurement/supplier-detail-header";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getSupplierDetail } from "@/lib/services/procurement/get-supplier-detail";

const PROCUREMENT_OVERVIEW_PERMISSION = "procurement.overview.read";
const SUPPLIERS_READ_PERMISSION = "suppliers.read";
const SUPPLIERS_UPDATE_PERMISSION = "suppliers.update";

/**
 * Create a DRAFT agreement for this supplier. Page gate: the supplier
 * card's read access plus suppliers.update — anyone missing one is sent to
 * "/" (same pattern as every workspace page). This is the page gate only:
 * createSupplierAgreementAction re-checks suppliers.update itself.
 */
export default async function NewSupplierAgreementPage(props: PageProps<"/procurement/suppliers/[id]/agreements/new">) {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    user = await requirePermission(PROCUREMENT_OVERVIEW_PERMISSION);
  } catch {
    redirect("/");
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);

  if (!permissionCodes.includes(SUPPLIERS_READ_PERMISSION) || !permissionCodes.includes(SUPPLIERS_UPDATE_PERMISSION)) {
    redirect("/");
  }

  const locale = await getCurrentLocale();
  const dictionary = getDictionary(locale);
  const t = dictionary.procurement.supplierDetail.agreementForm;

  const { id } = await props.params;
  const supplier = await getSupplierDetail(id);

  if (!supplier) {
    notFound();
  }

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath={`/procurement/suppliers/${supplier.id}/agreements/new`}
      dictionary={dictionary}
      showPeriodControl={false}
      showGlobalSearch={false}
    >
      <SupplierDetailHeader supplier={supplier} activeTab="agreements" dictionary={dictionary} />

      <div className="pb-4">
        <Link
          href={`/procurement/suppliers/${supplier.id}/agreements`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          {t.backToAgreements}
        </Link>
        <h2 className="mt-3 text-[20px] leading-[1.3] font-semibold tracking-tight text-slate-900">{t.title}</h2>
        <p className="mt-1 text-[13px] text-slate-500">{t.subtitle}</p>
      </div>

      <SupplierAgreementForm supplierId={supplier.id} locale={locale} dictionary={t} />
    </DashboardShell>
  );
}
