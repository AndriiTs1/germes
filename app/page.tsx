import { redirect } from "next/navigation";
import { DashboardAnalytics } from "@/components/dashboard/analytics/dashboard-analytics";
import { DashboardKpis } from "@/components/dashboard/dashboard-kpis";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { NoWorkspaceAvailable } from "@/components/dashboard/no-workspace-available";
import { DashboardOperations } from "@/components/dashboard/operations/dashboard-operations";
import { PeriodControl } from "@/components/dashboard/period-control";
import { requireUser } from "@/lib/auth/require-user";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";

const COMMAND_CENTER_PERMISSION = "dashboard.command_center.read";
const SALES_WORKSPACE_PERMISSION = "workspace.sales.access";
const WAREHOUSE_WORKSPACE_PERMISSION = "workspace.warehouse.access";
const FINANCE_WORKSPACE_PERMISSION = "finance.dashboard.read";

export default async function Home() {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);

  // Locale is presentation state, resolved independently of the permission
  // checks above/below — it never influences which workspace this resolver
  // redirects to.
  const locale = await getCurrentLocale();
  const dictionary = getDictionary(locale);

  if (!permissionCodes.includes(COMMAND_CENTER_PERMISSION)) {
    // Permission-driven landing resolver, not role-based: the first
    // workspace whose gate permission this user actually holds wins.
    if (permissionCodes.includes(WAREHOUSE_WORKSPACE_PERMISSION)) {
      redirect("/warehouse");
    }

    if (permissionCodes.includes(SALES_WORKSPACE_PERMISSION)) {
      redirect("/sales");
    }

    if (permissionCodes.includes(FINANCE_WORKSPACE_PERMISSION)) {
      redirect("/finance");
    }

    return (
      <DashboardShell
        user={user}
        permissionCodes={permissionCodes}
        activePath="/"
        dictionary={dictionary}
      >
        <NoWorkspaceAvailable dictionary={dictionary} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath="/"
      dictionary={dictionary}
    >
      <div className="pb-4">
        <h1 className="text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
          {dictionary.commandCenter.title}
        </h1>

        {/* Header hides the period control below md; it lives here instead. */}
        <div className="mt-4 md:hidden">
          <PeriodControl label={dictionary.commandCenter.periodThisMonth} />
        </div>
      </div>

      <DashboardKpis locale={locale} dictionary={dictionary} />

      <div className="mt-4">
        <DashboardAnalytics locale={locale} dictionary={dictionary} />
      </div>

      <div className="mt-4">
        <DashboardOperations locale={locale} dictionary={dictionary} />
      </div>

      {/* Step 5+: Team Performance. */}
    </DashboardShell>
  );
}
