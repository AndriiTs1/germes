import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { InternalSupportControls } from "@/components/settings/internal-support-controls";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getSupportTicket } from "@/lib/services/support/get-support-ticket";
import { listSupportAgents } from "@/lib/services/support/list-support-agents";
import { internalSupportTicketIdSchema } from "@/lib/validation/internal-support";

const SUPPORT_WORKSPACE_PERMISSION = "support.workspace.access";

type SupportTicketPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SupportTicketPage(
  props: SupportTicketPageProps,
) {
  let user: Awaited<ReturnType<typeof requirePermission>>;

  try {
    user = await requirePermission(SUPPORT_WORKSPACE_PERMISSION);
  } catch {
    redirect("/");
  }

  const { id } = await props.params;
  const parsedId = internalSupportTicketIdSchema.safeParse(id);

  if (!parsedId.success) {
    notFound();
  }

  const [permissionCodes, locale, ticket, agents] =
    await Promise.all([
      getPermissionCodesForUser(user.id),
      getCurrentLocale(),
      getSupportTicket(parsedId.data),
      listSupportAgents(),
    ]);

  if (!ticket) {
    notFound();
  }

  const dictionary = getDictionary(locale);
  const customerT = dictionary.settings.support;

  const statusLabels: Record<string, string> = {
    NEW: customerT.statuses.new,
    IN_PROGRESS: customerT.statuses.inProgress,
    WAITING_CUSTOMER: customerT.statuses.waitingCustomer,
    RESOLVED: customerT.statuses.resolved,
    CLOSED: customerT.statuses.closed,
  };

  const categoryLabels: Record<string, string> = {
    BUG: customerT.categories.bug,
    QUESTION: customerT.categories.question,
    FEATURE_REQUEST: customerT.categories.featureRequest,
    ACCOUNT: customerT.categories.account,
    OTHER: customerT.categories.other,
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
      <div className="mx-auto max-w-6xl">
        <Link
          href="/support"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Support Inbox
        </Link>

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11.5px] font-semibold text-violet-600">
                    GER-{String(ticket.number).padStart(6, "0")}
                  </p>

                  <h1 className="mt-1 text-[23px] font-semibold tracking-tight text-slate-900">
                    {ticket.subject}
                  </h1>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-slate-400">
                    <span>
                      {categoryLabels[ticket.category] ?? ticket.category}
                    </span>
                    <span>·</span>
                    <span>{ticket.priority}</span>
                    <span>·</span>
                    <span>
                      {statusLabels[ticket.status] ?? ticket.status}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-[12px] font-medium text-slate-700">
                    {ticket.createdBy.name ?? ticket.createdBy.email}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {ticket.createdBy.email}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
              <h2 className="text-[13.5px] font-semibold text-slate-900">
                Conversation
              </h2>

              <div className="mt-4 space-y-3">
                {ticket.messages.map((message) => {
                  const fromCustomer =
                    message.authorId === ticket.createdBy.id;

                  return (
                    <div
                      key={message.id}
                      className={
                        fromCustomer
                          ? "mr-auto max-w-[88%] rounded-2xl bg-slate-50 px-4 py-3"
                          : "ml-auto max-w-[88%] rounded-2xl bg-violet-50 px-4 py-3"
                      }
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11.5px] font-semibold text-slate-700">
                          {fromCustomer
                            ? message.author.name ??
                              message.author.email
                            : "Germes Support"}
                        </span>

                        <span className="text-[10.5px] text-slate-400">
                          {formatter.format(
                            new Date(message.createdAt),
                          )}
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
          </div>

          <aside>
            <InternalSupportControls
              ticketId={ticket.id}
              status={ticket.status}
              priority={ticket.priority}
              assignedToId={ticket.assignedTo?.id ?? null}
              agents={agents}
            />
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}
