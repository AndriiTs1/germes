"use client";

import { useState, useTransition } from "react";

import { addSupportMessageAction } from "@/app/settings/support/actions";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type SupportDictionary = Dictionary["settings"]["support"];

type Props = {
  ticketId: string;
  dictionary: SupportDictionary;
};

export function SupportReplyForm({ ticketId, dictionary }: Props) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);

    startTransition(async () => {
      const result = await addSupportMessageAction(ticketId, { body });

      if (result?.error) {
        setError(result.error);
        return;
      }

      setBody("");
    });
  }

  return (
    <form
      className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-[12.5px] font-semibold text-slate-700">
          {dictionary.reply}
        </span>

        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={10000}
          required
          rows={5}
          className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13.5px] leading-5 text-slate-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
          placeholder={dictionary.replyPlaceholder}
        />
      </label>

      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-[12.5px] text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={isPending || body.trim().length === 0}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? dictionary.sending : dictionary.sendMessage}
        </button>
      </div>
    </form>
  );
}
