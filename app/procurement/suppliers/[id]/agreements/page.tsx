import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SupplierAgreementsList } from "@/components/procurement/supplier-agreements-list";
import { SupplierDetailHeader } from "@/components/procurement/supplier-detail-header";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getSupplierDetail } from "@/lib/services/procurement/get-supplier-detail";
import { listSupplierAgreements } from "@/lib/services/procurement/list-supplier-agreements";
import { getBusinessDate } from "@/lib/services/procurement/supplier-agreement-display-status";

const PROCUREMENT_OVERVIEW_PERMISSION = "procurement.overview.read";
const SUPPLIERS_READ_PERMISSION = "suppliers.read";

/**
 * Read-only "Agreements" tab of the supplier card. Same access as the
 * card itself (procurement.overview.read AND suppliers.read, enforced here
 * on the server) and the same notFound() for an unknown supplier — the
 * agreements are only read once the supplier is known to exist.
 */
export default async function SupplierAgreementsPage(props: PageProps<"/procurement/suppliers/[id]/agreements">) {
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

  const { id } = await props.params;
  const supplier = await getSupplierDetail(id);

  if (!supplier) {
    notFound();
  }

  // One business date per request: every derived status on the page agrees.
  const agreements = await listSupplierAgreements(supplier.id, getBusinessDate(new Date()));

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath={`/procurement/suppliers/${supplier.id}/agreements`}
      dictionary={dictionary}
      showPeriodControl={false}
      showGlobalSearch={false}
    >
      <SupplierDetailHeader supplier={supplier} activeTab="agreements" dictionary={dictionary} />

      <SupplierAgreementsList agreements={agreements} locale={locale} dictionary={dictionary} />
    </DashboardShell>
  );
}
