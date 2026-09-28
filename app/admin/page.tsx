import { redirect } from "next/navigation";

import { AdminUsersOverview } from "@/components/admin/admin-users-overview";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getAdminAccessOverview } from "@/lib/services/admin/get-admin-access-overview";

const ADMIN_WORKSPACE_PERMISSION =
  "workspace.admin.access";

export default async function AdminPage() {
  let user: Awaited<
    ReturnType<typeof requirePermission>
  >;

  try {
    user = await requirePermission(
      ADMIN_WORKSPACE_PERMISSION,
    );
  } catch {
    redirect("/");
  }

  const permissionCodes =
    await getPermissionCodesForUser(user.id);

  const locale = await getCurrentLocale();
  const dictionary = getDictionary(locale);

  const canReadUsers =
    permissionCodes.includes(
      "team.users.read",
    );

  const overview = canReadUsers
    ? await getAdminAccessOverview()
    : null;

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath="/admin"
      dictionary={dictionary}
      showPeriodControl={false}
      showGlobalSearch={false}
    >
      <div className="pb-4">
        <h1 className="text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
          {dictionary.admin.workspace.title}
        </h1>
      </div>

      {overview ? (
        <AdminUsersOverview
          overview={overview}
          dictionary={dictionary}
        />
      ) : null}
    </DashboardShell>
  );
}
