import { redirect } from "next/navigation";
import { DashboardAnalytics } from "@/components/dashboard/analytics/dashboard-analytics";
import { DashboardKpis } from "@/components/dashboard/dashboard-kpis";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { NoWorkspaceAvailable } from "@/components/dashboard/no-workspace-available";
import { DashboardOperations } from "@/components/dashboard/operations/dashboard-operations";
import { PeriodControl } from "@/components/dashboard/period-control";
import { logout } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/require-user";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";

const COMMAND_CENTER_PERMISSION = "dashboard.command_center.read";

export default async function Home() {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);

  if (!permissionCodes.includes(COMMAND_CENTER_PERMISSION)) {
    return (
      <DashboardShell user={user} permissionCodes={permissionCodes}>
        <NoWorkspaceAvailable />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell user={user} permissionCodes={permissionCodes}>
      <div className="pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
            Command Center
          </h1>

          <form action={logout}>
            <button
              type="submit"
              className="text-[13px] font-medium text-slate-500 hover:text-slate-700"
            >
              Sign out
            </button>
          </form>
        </div>

        {/* Header hides the period control below md; it lives here instead. */}
        <div className="mt-4 md:hidden">
          <PeriodControl />
        </div>
      </div>

      <DashboardKpis />

      <div className="mt-4">
        <DashboardAnalytics />
      </div>

      <div className="mt-4">
        <DashboardOperations />
      </div>

      {/* Step 5+: Team Performance. */}
    </DashboardShell>
  );
}
