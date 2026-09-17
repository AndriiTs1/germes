import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SalesWorkspace } from "@/components/sales/sales-workspace";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";

const SALES_WORKSPACE_PERMISSION = "workspace.sales.access";

export default async function SalesPage() {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    // requirePermission() already fails closed for both "not authenticated"
    // and "authenticated but missing this permission" — either way, "/"
    // is the correct place to send them: it re-resolves to /login, the
    // Command Center, or NoWorkspaceAvailable based on their real
    // permissions, with no risk of a loop back to /sales.
    user = await requirePermission(SALES_WORKSPACE_PERMISSION);
  } catch {
    redirect("/");
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);

  const locale = await getCurrentLocale();
  const dictionary = getDictionary(locale);

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath="/sales"
      dictionary={dictionary}
      showPeriodControl={false}
    >
      <div className="pb-4 xl:pb-2.5">
        {/* md:leading-[1.5] is for tablet readability; xl:leading-[1.2] pulls it back to the compact value at true desktop widths, where the row height matters for the 1440x900 fit. */}
        <h1 className="text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5] xl:leading-[1.2]">
          {dictionary.sales.workspace.title}
        </h1>
        <p className="mt-1 text-[13px] text-slate-500 xl:mt-0.5 xl:text-slate-400">
          {dictionary.sales.workspace.subtitle}
        </p>
      </div>

      <SalesWorkspace userId={user.id} permissionCodes={permissionCodes} locale={locale} dictionary={dictionary} />
    </DashboardShell>
  );
}
