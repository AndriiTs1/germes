import { LifeBuoy, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { listSupportTickets } from "@/lib/services/support/list-support-tickets";

const SUPPORT_WORKSPACE_PERMISSION = "support.workspace.access";

export default async function SupportPage() {
  let user: Awaited<ReturnType<typeof requirePermission>>;

  try {
    user = await requirePermission(SUPPORT_WORKSPACE_PERMISSION);
  } catch {
    redirect("/");
  }

  const [permissionCodes, locale, result] = await Promise.all([
    getPermissionCodesForUser(user.id),
    getCurrentLocale(),
    listSupportTickets(),
  ]);

  const dictionary = getDictionary(locale);
  const t = dictionary.settings.support;

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
      activePath="/support"
      dictionary={dictionary}
      showPeriodControl={false}
    >
      <div className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <LifeBuoy className="h-5 w-5" strokeWidth={1.75} />
          </div>

          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">
              Support Inbox
            </h1>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Customer requests and support conversations
            </p>
          </div>
        </div>
      </div>

      {result.tickets.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/70 bg-white px-6 py-14 text-center">
          <LifeBuoy
            className="mx-auto h-6 w-6 text-violet-400"
            strokeWidth={1.6}
          />
          <p className="mt-3 text-[13.5px] font-semibold text-slate-800">
            No support requests
          </p>
          <p className="mt-1 text-[12.5px] text-slate-500">
            New customer requests will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {result.tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/support/${ticket.id}`}
              className="block rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-violet-200 hover:shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11.5px] font-semibold text-violet-600">
                      GER-{String(ticket.number).padStart(6, "0")}
                    </span>

                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600">
                      {statusLabels[ticket.status] ?? ticket.status}
                    </span>

                    <span className="text-[11px] text-slate-400">
                      {categoryLabels[ticket.category] ?? ticket.category}
                    </span>
                  </div>

                  <h2 className="mt-1.5 truncate text-[14px] font-semibold text-slate-900">
                    {ticket.subject}
                  </h2>

                  <p className="mt-1 text-[12px] text-slate-500">
                    {ticket.createdBy.name ?? ticket.createdBy.email}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3 text-[11.5px] text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <MessageSquareText
                      className="h-3.5 w-3.5"
                      strokeWidth={1.75}
                    />
                    {ticket.messageCount}
                  </span>

                  <span>
                    {formatter.format(new Date(ticket.lastMessageAt))}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
