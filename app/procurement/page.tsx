import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ProcurementWorkspaceOverview } from "@/components/procurement/procurement-workspace-overview";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getProcurementWorkspaceOverview } from "@/lib/services/procurement/get-procurement-workspace-overview";

const PROCUREMENT_OVERVIEW_PERMISSION = "procurement.overview.read";

/**
 * Procurement control overview — a report, not a work surface. It shows
 * only what PurchaseOrder data proves (exceptions, current state, planned
 * arrivals) and carries no operational controls, so every holder of
 * procurement.overview.read sees the same facts. Creating orders happens
 * on /procurement/orders; suppliers live at /procurement/suppliers.
 */
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

  const [permissionCodes, locale, overview] = await Promise.all([
    getPermissionCodesForUser(user.id),
    getCurrentLocale(),
    getProcurementWorkspaceOverview(),
  ]);
  const dictionary = getDictionary(locale);

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath="/procurement"
      dictionary={dictionary}
      showPeriodControl={false}
      // The global header search isn't wired for the Procurement workspace
      // (same as /procurement/orders and /procurement/suppliers).
      showGlobalSearch={false}
    >
      <div className="pb-4">
        <h1 className="text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
          {dictionary.procurement.workspace.title}
        </h1>
      </div>

      <ProcurementWorkspaceOverview overview={overview} locale={locale} dictionary={dictionary} />
    </DashboardShell>
  );
}
