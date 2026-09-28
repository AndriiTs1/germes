import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type SalesKpiAccent = "rose" | "blue" | "amber" | "violet";

const accentChipStyles: Record<SalesKpiAccent, string> = {
  rose: "bg-rose-50 text-rose-600",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
};

export type SalesKpiCardProps = {
  label: string;
  /** One value, or one full line per currency (money is never summed across currencies). */
  value: string | string[];
  unit?: string;
  icon: LucideIcon;
  accent: SalesKpiAccent;
  /** Shown instead of a trend row — SALES KPIs have no comparison data. */
  warning?: string;
};

/**
 * Deliberately not a reuse of the Owner KpiCard: that component requires
 * trendValue/trendDirection/trendSentiment/comparisonLabel, and SALES V1
 * KPIs have no trend data — inventing one would be a fake comparison.
 * Same border/radius/shadow/typography language, no trend row.
 *
 * Desktop (xl:) polish only — mobile/tablet keep the exact original
 * classes. xl:min-h- on the label row reserves the same height whether a
 * label wraps to one or two lines, so all four cards' value rows share one
 * baseline regardless of label length; the icon chip gets a hairline inset
 * ring for a touch more definition without changing its accent tint.
 */
function SalesKpiCard({ label, value, unit, icon: Icon, accent, warning }: SalesKpiCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)] xl:py-3.5 xl:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_-10px_rgba(15,23,42,0.10)]">
      <div className="flex items-start gap-2.5 xl:min-h-[34px]">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] xl:ring-1 xl:ring-inset xl:ring-black/5",
            accentChipStyles[accent],
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <p className="line-clamp-2 pt-1 text-[13px] leading-[1.25] font-medium text-slate-500">
          {label}
        </p>
      </div>

      {Array.isArray(value) ? (
        <ValueLines lines={value} className="mt-3 xl:mt-2.5" />
      ) : (
        <div className="mt-3 flex items-baseline gap-1.5 xl:mt-2.5">
          <span className="text-[22px] leading-none font-semibold whitespace-nowrap tracking-tight text-slate-900 xl:text-[23px] xl:font-bold">
            {value}
          </span>
          {unit ? (
            <span className="text-[11.5px] leading-none font-medium whitespace-nowrap text-slate-400 xl:text-[11px] xl:font-normal">
              {unit}
            </span>
          ) : null}
        </div>
      )}

      {warning ? (
        <p className="mt-2 truncate text-[11.5px] font-medium text-amber-600">{warning}</p>
      ) : (
        <div className="mt-2 h-[15px]" aria-hidden="true" />
      )}
    </div>
  );
}

/**
 * One line per currency, slightly smaller than a single KPI number so a full
 * amount fits the card. Never truncated: Intl group separators are
 * non-breaking, so a too-narrow card can only wrap before the currency code.
 */
function ValueLines({ lines, className }: { lines: string[]; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {lines.map((line) => (
        <span key={line} className="text-[18px] leading-tight font-semibold tracking-tight text-slate-900 xl:text-[19px] xl:font-bold">
          {line}
        </span>
      ))}
    </div>
  );
}

function SalesKpiRow({ label, value, unit, icon: Icon, accent, warning }: SalesKpiCardProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
          accentChipStyles[accent],
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>

      <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-500">{label}</p>

      <div className="shrink-0 text-right">
        {Array.isArray(value) ? (
          <ValueLines lines={value} className="items-end" />
        ) : (
          <div className="flex items-baseline justify-end gap-1.5">
            <span className="text-[22px] leading-none font-semibold whitespace-nowrap tracking-tight text-slate-900">
              {value}
            </span>
            {unit ? (
              <span className="text-[11.5px] leading-none font-medium whitespace-nowrap text-slate-400">
                {unit}
              </span>
            ) : null}
          </div>
        )}
        {warning ? (
          <p className="mt-1 text-[11px] font-medium text-amber-600">{warning}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Desktop/tablet grid (>=768px) plus the mobile compact-rows-in-one-card
 * pattern already established by Owner's DashboardKpis — same responsive
 * technique, SALES-specific data and no trend fields.
 *
 * The 1280px step is written in rem (80rem): Tailwind v4 emits a px
 * arbitrary breakpoint before the rem-based md:, so md:grid-cols-2 used to
 * win and the row stayed 2×2 at every desktop width.
 */
export function SalesKpiSummary({ items }: { items: SalesKpiCardProps[] }) {
  if (items.length === 0) return null;

  const desktopGridClass =
    items.length === 1
      ? "md:grid-cols-1"
      : items.length === 2
        ? "md:grid-cols-2"
        : items.length === 3
          ? "md:grid-cols-2 min-[80rem]:grid-cols-3"
          : "md:grid-cols-2 min-[80rem]:grid-cols-4";

  return (
    <>
      <div className={cn("hidden gap-3 md:grid", desktopGridClass)}>
        {items.map((item) => (
          <SalesKpiCard key={item.label} {...item} />
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)] md:hidden">
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.label}>
              <SalesKpiRow {...item} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
