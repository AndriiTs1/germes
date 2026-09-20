import { ArrowRight, Bell, CircleHelp, ShieldCheck, UserRound } from "lucide-react";

import { setLocaleAction } from "@/app/settings/actions";
import { logout } from "@/lib/auth/actions";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type SettingsViewProps = {
  locale: Locale;
  dictionary: Dictionary;
};

const cardClassName =
  "rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06)] xl:p-5";

export function SettingsView({ locale, dictionary }: SettingsViewProps) {
  const futureSections = [
    { icon: UserRound, label: dictionary.settings.more.profile },
    { icon: Bell, label: dictionary.settings.more.notifications },
    { icon: ShieldCheck, label: dictionary.settings.more.security },
  ];

  return (
    <div className="flex flex-col gap-4 xl:gap-3.5">
      <section className={cardClassName}>
        <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900">
          {dictionary.settings.general.title}
        </h2>
        <p className="mt-0.5 text-[12px] text-slate-400">{dictionary.settings.general.language}</p>

        <ul className="mt-3 divide-y divide-slate-100">
          {SUPPORTED_LOCALES.map((code) => {
            const isCurrent = code === locale;
            const label = dictionary.settings.languages[code];

            return (
              <li key={code} className="group">
                {isCurrent ? (
                  <div
                    className="flex items-center justify-between gap-3 py-2.5 group-first:pt-0 group-last:pb-0"
                    aria-current="true"
                  >
                    <span className="text-[13.5px] font-medium text-slate-900">{label}</span>
                    <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-blue-600">
                      {dictionary.settings.language.current}
                    </span>
                  </div>
                ) : (
                  <form action={setLocaleAction}>
                    <input type="hidden" name="locale" value={code} />
                    <button
                      type="submit"
                      className="flex w-full items-center justify-between gap-3 rounded-lg py-2.5 text-left transition-colors group-first:pt-0 group-last:pb-0 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none"
                    >
                      <span className="text-[13.5px] font-medium text-slate-600">{label}</span>
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={cardClassName}>
        <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900">
          {dictionary.settings.more.title}
        </h2>

        <ul className="mt-3 divide-y divide-slate-100">
          {futureSections.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex cursor-not-allowed items-center justify-between gap-3 py-2.5 opacity-60 first:pt-0 last:pb-0"
            >
              <span className="flex items-center gap-2.5 text-[13.5px] font-medium text-slate-500">
                <Icon className="h-4 w-4 shrink-0 text-slate-300" strokeWidth={1.75} />
                {label}
              </span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-slate-400">
                {dictionary.settings.comingSoon}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={cardClassName}>
        <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900">
          {dictionary.settings.support.title}
        </h2>

        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <CircleHelp className="h-4 w-4" strokeWidth={1.75} />
              </span>

              <span>
                <span className="block text-[13.5px] font-medium text-slate-700">
                  {dictionary.settings.support.createTicket}
                </span>
                <span className="block text-[11.5px] text-slate-400">
                  {dictionary.settings.support.contactDescription}
                </span>
              </span>
            </span>

            <ArrowRight className="h-4 w-4 text-slate-300" strokeWidth={1.75} />
          </button>

          <button
            type="button"
            className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
          >
            <span>
              <span className="block text-[13.5px] font-medium text-slate-700">
                {dictionary.settings.support.myTickets}
              </span>
              <span className="block text-[11.5px] text-slate-400">
                {dictionary.settings.support.historyDescription}
              </span>
            </span>

            <ArrowRight className="h-4 w-4 text-slate-300" strokeWidth={1.75} />
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-red-200/70 bg-red-50/40 p-4 xl:p-5">
        <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900">
          {dictionary.settings.account.title}
        </h2>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12.5px] text-slate-500">
            {dictionary.settings.account.signOutDescription}
          </p>

          <form action={logout}>
            <button
              type="submit"
              className="shrink-0 rounded-full border border-red-200 bg-white px-4 py-2 text-[13px] font-semibold text-red-600 transition-colors hover:bg-red-50"
            >
              {dictionary.settings.account.signOut}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
