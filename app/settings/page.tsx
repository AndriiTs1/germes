import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SettingsView } from "@/components/settings/settings-view";
import { requireUser } from "@/lib/auth/require-user";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";

export default async function SettingsPage() {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    // Settings is personal, authenticated-user functionality — not gated
    // behind any workspace or administrative permission. requireUser()
    // (not requirePermission()) is the correct gate: any authenticated,
    // active Germes user must be able to reach it and sign out.
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);

  // Locale is presentation state, resolved independently of auth/permissions
  // (see lib/i18n/locale.ts) — it is never allowed to influence the checks
  // above. DashboardShell/nav are not localized yet (L3+); only this page's
  // own content is.
  const locale = await getCurrentLocale();
  const dictionary = getDictionary(locale);

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath="/settings"
      showPeriodControl={false}
    >
      <div className="pb-4">
        <h1 className="text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
          {dictionary.settings.title}
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">{dictionary.settings.subtitle}</p>
      </div>

      <SettingsView locale={locale} dictionary={dictionary} />
    </DashboardShell>
  );
}
