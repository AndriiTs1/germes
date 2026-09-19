import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { FinanceReceivablesList } from "@/components/finance/receivables-list";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { listReceivables } from "@/lib/services/finance/list-receivables";

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

  const canReadReceivables = permissionCodes.includes("finance.receivables.read");
  const canUpdateReceivables = permissionCodes.includes(
    "finance.receivables.update",
  );
  const receivables = canReadReceivables ? await listReceivables() : [];

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

      {canReadReceivables ? (
        <section>
          <h2 className="mb-3 text-[14px] font-semibold text-slate-900">
            {dictionary.finance.receivables.title}
          </h2>
          <FinanceReceivablesList
            receivables={receivables}
            locale={locale}
            dictionary={dictionary}
            canUpdateReceivables={canUpdateReceivables}
          />
        </section>
      ) : null}
    </DashboardShell>
  );
}
