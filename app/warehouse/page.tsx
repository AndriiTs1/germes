import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { WarehouseWorkspace } from "@/components/warehouse/warehouse-workspace";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
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

  const locale = await getCurrentLocale();
  const dictionary = getDictionary(locale);

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath="/warehouse"
      dictionary={dictionary}
      showPeriodControl={false}
    >
      <div className="pb-4">
        <h1 className="text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
          {dictionary.warehouse.workspace.title}
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">
          {dictionary.warehouse.workspace.subtitle}
        </p>
      </div>

      <WarehouseWorkspace
        locale={locale}
        dictionary={dictionary}
        canReadStock={permissionCodes.includes("inventory.stock.read")}
      />
    </DashboardShell>
  );
}
