"use client";

import { useState, useTransition } from "react";

import {
  addInternalSupportMessageAction,
  updateInternalSupportTicketAction,
} from "@/app/support/actions";

type SupportAgent = {
  id: string;
  name: string | null;
  email: string;
};

type Props = {
  ticketId: string;
  status: string;
  priority: string;
  assignedToId: string | null;
  agents: SupportAgent[];
};

export function InternalSupportControls({
  ticketId,
  status,
  priority,
  assignedToId,
  agents,
}: Props) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateTicket(input: {
    status?: "NEW" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "RESOLVED" | "CLOSED";
    priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    assignedToId?: string | null;
  }) {
    setError(null);

    startTransition(async () => {
      const result = await updateInternalSupportTicketAction(
        ticketId,
        input,
      );

      if (result?.error) {
        setError(result.error);
      }
    });
  }

  function sendReply() {
    const trimmed = body.trim();

    if (!trimmed) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await addInternalSupportMessageAction(
        ticketId,
        { body: trimmed },
      );

      if (result?.error) {
        setError(result.error);
        return;
      }

      setBody("");
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h2 className="text-[13px] font-semibold text-slate-900">
          Request control
        </h2>

        <div className="mt-4 grid gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium text-slate-500">
              Status
            </span>

            <select
              defaultValue={status}
              disabled={isPending}
              onChange={(event) =>
                updateTicket({
                  status: event.target.value as
                    | "NEW"
                    | "IN_PROGRESS"
                    | "WAITING_CUSTOMER"
                    | "RESOLVED"
                    | "CLOSED",
                })
              }
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            >
              <option value="NEW">New</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="WAITING_CUSTOMER">Waiting for customer</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium text-slate-500">
              Priority
            </span>

            <select
              defaultValue={priority}
              disabled={isPending}
              onChange={(event) =>
                updateTicket({
                  priority: event.target.value as
                    | "LOW"
                    | "NORMAL"
                    | "HIGH"
                    | "URGENT",
                })
              }
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium text-slate-500">
              Assigned to
            </span>

            <select
              defaultValue={assignedToId ?? ""}
              disabled={isPending}
              onChange={(event) =>
                updateTicket({
                  assignedToId:
                    event.target.value || null,
                })
              }
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            >
              <option value="">Unassigned</option>

              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name ?? agent.email}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {status === "CLOSED" ? (
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-[12.5px] text-slate-500">
          This request is closed. Reopen it before sending another reply.
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            sendReply();
          }}
          className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium text-slate-500">
              Reply
            </span>

            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
              maxLength={10000}
              placeholder="Write a reply to the customer..."
              className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] leading-5 text-slate-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            />
          </label>

          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={isPending || body.trim().length === 0}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Sending..." : "Send reply"}
            </button>
          </div>
        </form>
      )}

      {error ? (
        <div className="rounded-xl bg-red-50 px-3 py-2.5 text-[12.5px] text-red-600">
          {error}
        </div>
      ) : null}
    </div>
  );
}
