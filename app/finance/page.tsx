import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";

const FINANCE_DASHBOARD_PERMISSION = "finance.dashboard.read";

export default async function FinancePage() {
  let user: Awaited<ReturnType<typeof requirePermission>>;

  try {
    user = await requirePermission(FINANCE_DASHBOARD_PERMISSION);
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
      activePath="/finance"
      dictionary={dictionary}
      showPeriodControl={false}
    >
      <div className="pb-4">
        <h1 className="text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
          {dictionary.finance.workspace.title}
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">
          {dictionary.finance.workspace.subtitle}
        </p>
      </div>
    </DashboardShell>
  );
}
