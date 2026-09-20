import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SupportTicketForm } from "@/components/settings/support-ticket-form";
import { requireUser } from "@/lib/auth/require-user";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";

export default async function NewSupportTicketPage() {
  let user: Awaited<ReturnType<typeof requireUser>>;

  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const [permissionCodes, locale] = await Promise.all([
    getPermissionCodesForUser(user.id),
    getCurrentLocale(),
  ]);

  const dictionary = getDictionary(locale);
  const t = dictionary.settings.support;

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath="/settings"
      dictionary={dictionary}
      showPeriodControl={false}
    >
      <div className="mx-auto max-w-3xl">
        <div className="pb-4">
          <Link
            href="/settings/support"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            {t.myTickets}
          </Link>

          <h1 className="mt-3 text-[26px] font-semibold tracking-tight text-slate-900">
            {t.newTitle}
          </h1>

          <p className="mt-1 text-[13px] text-slate-500">
            {t.newSubtitle}
          </p>
        </div>

        <SupportTicketForm dictionary={t} />
      </div>
    </DashboardShell>
  );
}
