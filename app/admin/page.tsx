import { redirect } from "next/navigation";
import { Search } from "lucide-react";

import { AdminUsersOverview } from "@/components/admin/admin-users-overview";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { listAdminUsers } from "@/lib/services/admin/list-users";

const ADMIN_WORKSPACE_PERMISSION = "workspace.admin.access";

export default async function AdminPage() {
  let user: Awaited<ReturnType<typeof requirePermission>>;

  try {
    user = await requirePermission(ADMIN_WORKSPACE_PERMISSION);
  } catch {
    redirect("/");
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);
  const locale = await getCurrentLocale();
  const dictionary = getDictionary(locale);

  const canReadUsers = permissionCodes.includes("team.users.read");
  const users = canReadUsers ? await listAdminUsers() : [];

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath="/admin"
      dictionary={dictionary}
      showPeriodControl={false}
      compactSearchPlaceholder={dictionary.admin.search.compactPlaceholder}
    >
      <div className="pb-4">
        <h1 className="text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
          {dictionary.admin.workspace.title}
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">
          {dictionary.admin.workspace.subtitle}
        </p>

        <div className="relative mt-4 md:hidden">
          <label htmlFor="admin-mobile-search" className="sr-only">
            {dictionary.header.searchAriaLabel}
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
            strokeWidth={1.75}
          />
          <input
            id="admin-mobile-search"
            type="search"
            placeholder={dictionary.admin.search.placeholder}
            className="h-10 w-full rounded-full border border-slate-200/80 bg-white pr-4 pl-10 text-base text-slate-800 shadow-sm placeholder:text-slate-400 transition-colors focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
          />
        </div>
      </div>

      {canReadUsers ? (
        <AdminUsersOverview users={users} dictionary={dictionary} />
      ) : null}
    </DashboardShell>
  );
}
