import { ArrowLeft, LifeBuoy, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireUser } from "@/lib/auth/require-user";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { listMySupportTickets } from "@/lib/services/support/list-my-support-tickets";

export default async function SupportPage() {
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
  const result = await listMySupportTickets(user.id);

  const statusLabels: Record<string, string> = {
    NEW: t.statuses.new,
    IN_PROGRESS: t.statuses.inProgress,
    WAITING_CUSTOMER: t.statuses.waitingCustomer,
    RESOLVED: t.statuses.resolved,
    CLOSED: t.statuses.closed,
  };

  const categoryLabels: Record<string, string> = {
    BUG: t.categories.bug,
    QUESTION: t.categories.question,
    FEATURE_REQUEST: t.categories.featureRequest,
    ACCOUNT: t.categories.account,
    OTHER: t.categories.other,
  };

  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath="/settings"
      dictionary={dictionary}
      showPeriodControl={false}
    >
      <div className="pb-4">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          {t.backToSettings}
        </Link>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">
              {t.myTickets}
            </h1>
            <p className="mt-1 text-[13px] text-slate-500">{t.pageSubtitle}</p>
          </div>

          <Link
            href="/settings/support/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-[13px] font-semibold text-white transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" strokeWidth={1.8} />
            {t.newRequest}
          </Link>
        </div>
      </div>

      {result.tickets.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/70 bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <LifeBuoy className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <h2 className="mt-4 text-[15px] font-semibold text-slate-900">
            {t.emptyTitle}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] text-slate-500">
            {t.emptyDescription}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {result.tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-semibold text-violet-600">
                      GER-{String(ticket.number).padStart(6, "0")}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600">
                      {statusLabels[ticket.status] ?? ticket.status}
                    </span>
                  </div>

                  <h2 className="mt-1.5 text-[14px] font-semibold text-slate-900">
                    {ticket.subject}
                  </h2>

                  <p className="mt-1 text-[11.5px] text-slate-400">
                    {categoryLabels[ticket.category] ?? ticket.category}
                    {" · "}
                    {ticket.messageCount} {t.messages}
                  </p>
                </div>

                <p className="shrink-0 text-[11.5px] text-slate-400">
                  {t.updated}{" "}
                  {formatter.format(new Date(ticket.lastMessageAt))}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
