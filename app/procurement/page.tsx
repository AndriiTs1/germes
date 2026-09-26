import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ProcurementOverview } from "@/components/procurement/procurement-overview";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getProcurementOverview } from "@/lib/services/procurement/get-procurement-overview";

const PROCUREMENT_OVERVIEW_PERMISSION = "procurement.overview.read";
const SUPPLIERS_READ_PERMISSION = "suppliers.read";

export default async function ProcurementPage() {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    // Same reasoning as every other workspace route (/sales, /warehouse):
    // any failure here (unauthenticated or missing this permission) is
    // safest resolved by "/", which re-derives the correct destination from
    // the user's real permissions.
    user = await requirePermission(PROCUREMENT_OVERVIEW_PERMISSION);
  } catch {
    redirect("/");
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);

  const locale = await getCurrentLocale();
  const dictionary = getDictionary(locale);

  // Per-widget check before the query, as in SalesWorkspace: supplier
  // counts are supplier data, so they are only fetched with suppliers.read.
  const overview = permissionCodes.includes(SUPPLIERS_READ_PERMISSION)
    ? await getProcurementOverview()
    : null;

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath="/procurement"
      dictionary={dictionary}
      showPeriodControl={false}
    >
      <div className="pb-4">
        <h1 className="text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
          {dictionary.procurement.workspace.title}
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">{dictionary.procurement.workspace.subtitle}</p>
      </div>

      <ProcurementOverview overview={overview} dictionary={dictionary} />
    </DashboardShell>
  );
}
