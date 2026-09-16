import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { WarehouseWorkspace } from "@/components/warehouse/warehouse-workspace";
import { logout } from "@/lib/auth/actions";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";

const WAREHOUSE_WORKSPACE_PERMISSION = "workspace.warehouse.access";

export default async function WarehousePage() {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    // Same reasoning as every other workspace route (/sales, /sales/orders):
    // any failure here (unauthenticated or missing this permission) is
    // safest resolved by "/", which re-derives the correct destination from
    // the user's real permissions.
    user = await requirePermission(WAREHOUSE_WORKSPACE_PERMISSION);
  } catch {
    redirect("/");
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath="/warehouse"
      showPeriodControl={false}
    >
      <div className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
              Warehouse Workspace
            </h1>
            <p className="mt-1 text-[13px] text-slate-500">
              Fulfillment queue and warehouse operations
            </p>
          </div>

          <form action={logout}>
            <button
              type="submit"
              className="text-[13px] font-medium text-slate-500 hover:text-slate-700"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      <WarehouseWorkspace />
    </DashboardShell>
  );
}
