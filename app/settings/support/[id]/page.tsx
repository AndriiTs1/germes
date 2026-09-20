import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SupportReplyForm } from "@/components/settings/support-reply-form";
import { requireUser } from "@/lib/auth/require-user";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { getMySupportTicket } from "@/lib/services/support/get-my-support-ticket";

type SupportTicketDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SupportTicketDetailPage(
  props: SupportTicketDetailPageProps,
) {
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

  const { id } = await props.params;
  const ticket = await getMySupportTicket(user.id, id);

  if (!ticket) {
    notFound();
  }

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
      <div className="mx-auto max-w-4xl">
        <div className="pb-4">
          <Link
            href="/settings/support"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            {t.backToRequests}
          </Link>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-violet-600">
                {t.ticketNumber} GER-{String(ticket.number).padStart(6, "0")}
              </p>

              <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-slate-900">
                {ticket.subject}
              </h1>

              <p className="mt-1 text-[12.5px] text-slate-400">
                {categoryLabels[ticket.category] ?? ticket.category}
              </p>
            </div>

            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {statusLabels[ticket.status] ?? ticket.status}
            </span>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
          <h2 className="text-[13.5px] font-semibold text-slate-900">
            {t.conversation}
          </h2>

          <div className="mt-4 space-y-3">
            {ticket.messages.map((message) => {
              const isCurrentUser = message.authorId === user.id;

              return (
                <div
                  key={message.id}
                  className={
                    isCurrentUser
                      ? "ml-auto max-w-[88%] rounded-2xl bg-violet-50 px-4 py-3"
                      : "mr-auto max-w-[88%] rounded-2xl bg-slate-50 px-4 py-3"
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11.5px] font-semibold text-slate-700">
                      {message.authorName ?? message.authorEmail}
                    </span>
                    <span className="text-[10.5px] text-slate-400">
                      {formatter.format(new Date(message.createdAt))}
                    </span>
                  </div>

                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-5 text-slate-700">
                    {message.body}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-4">
          {ticket.status === "CLOSED" ? (
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-[12.5px] text-slate-500">
              {t.closedNotice}
            </div>
          ) : (
            <SupportReplyForm ticketId={ticket.id} dictionary={t} />
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
