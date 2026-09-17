import { Bell, ShieldCheck, UserRound } from "lucide-react";

import { logout } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

type Language = {
  code: string;
  label: string;
  current: boolean;
};

// English is the only implemented UI language today. Ukrainian/Russian are
// listed to establish the future structure — no i18n exists yet, so they
// stay visibly non-interactive until that lands. Localization will only
// ever translate system UI (nav, labels, buttons, statuses, messages,
// date presentation), never stored business data (customers, products,
// invoices, documents, user-entered text).
const LANGUAGES: Language[] = [
  { code: "en", label: "English", current: true },
  { code: "uk", label: "Українська", current: false },
  { code: "ru", label: "Русский", current: false },
];

const FUTURE_SECTIONS = [
  { icon: UserRound, label: "Profile" },
  { icon: Bell, label: "Notifications" },
  { icon: ShieldCheck, label: "Security" },
];

const cardClassName =
  "rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06)] xl:p-5";

export function SettingsView() {
  return (
    <div className="flex flex-col gap-4 xl:gap-3.5">
      <section className={cardClassName}>
        <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900">General</h2>
        <p className="mt-0.5 text-[12px] text-slate-400">Language</p>

        <ul className="mt-3 divide-y divide-slate-100">
          {LANGUAGES.map((language) => (
            <li
              key={language.code}
              className={cn(
                "flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0",
                !language.current && "cursor-not-allowed",
              )}
            >
              <span
                className={cn(
                  "text-[13.5px] font-medium",
                  language.current ? "text-slate-900" : "text-slate-400",
                )}
              >
                {language.label}
              </span>
              {language.current ? (
                <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-blue-600">
                  Current
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-slate-400">
                  Coming soon
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={cardClassName}>
        <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900">
          More settings
        </h2>

        <ul className="mt-3 divide-y divide-slate-100">
          {FUTURE_SECTIONS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex cursor-not-allowed items-center justify-between gap-3 py-2.5 opacity-60 first:pt-0 last:pb-0"
            >
              <span className="flex items-center gap-2.5 text-[13.5px] font-medium text-slate-500">
                <Icon className="h-4 w-4 shrink-0 text-slate-300" strokeWidth={1.75} />
                {label}
              </span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-slate-400">
                Coming soon
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-red-200/70 bg-red-50/40 p-4 xl:p-5">
        <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900">Account</h2>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12.5px] text-slate-500">
            Sign out of your Germes account on this device.
          </p>

          <form action={logout}>
            <button
              type="submit"
              className="shrink-0 rounded-full border border-red-200 bg-white px-4 py-2 text-[13px] font-semibold text-red-600 transition-colors hover:bg-red-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
