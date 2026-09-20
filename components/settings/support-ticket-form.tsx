"use client";

import { useState, useTransition } from "react";
import { createSupportTicketAction } from "@/app/settings/support/actions";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { CreateSupportTicketFormValues } from "@/lib/validation/support";

type SupportDictionary = Dictionary["settings"]["support"];

type Props = {
  dictionary: SupportDictionary;
};

const categories: CreateSupportTicketFormValues["category"][] = [
  "BUG",
  "QUESTION",
  "FEATURE_REQUEST",
  "ACCOUNT",
  "OTHER",
];

export function SupportTicketForm({ dictionary }: Props) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] =
    useState<CreateSupportTicketFormValues["category"]>("QUESTION");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const categoryLabels: Record<
    CreateSupportTicketFormValues["category"],
    string
  > = {
    BUG: dictionary.categories.bug,
    QUESTION: dictionary.categories.question,
    FEATURE_REQUEST: dictionary.categories.featureRequest,
    ACCOUNT: dictionary.categories.account,
    OTHER: dictionary.categories.other,
  };

  function submit() {
    setError(null);

    startTransition(async () => {
      const result = await createSupportTicketAction({
        subject,
        category,
        body,
      });

      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <form
      className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06)] sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-slate-700">
            {dictionary.subject}
          </span>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            maxLength={160}
            required
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13.5px] text-slate-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            placeholder={dictionary.subjectPlaceholder}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-slate-700">
            {dictionary.category}
          </span>
          <select
            value={category}
            onChange={(event) =>
              setCategory(
                event.target.value as CreateSupportTicketFormValues["category"],
              )
            }
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13.5px] text-slate-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
          >
            {categories.map((value) => (
              <option key={value} value={value}>
                {categoryLabels[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-slate-700">
            {dictionary.message}
          </span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            minLength={10}
            maxLength={10000}
            required
            rows={8}
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13.5px] leading-5 text-slate-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            placeholder={dictionary.messagePlaceholder}
          />
        </label>

        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2.5 text-[12.5px] text-red-600">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? dictionary.sending : dictionary.sendRequest}
          </button>
        </div>
      </div>
    </form>
  );
}
