import { ArrowUpRight } from "lucide-react";

import { AnalyticsCard } from "@/components/dashboard/analytics/analytics-card";
import { getSalesPerformance } from "@/lib/services/dashboard/get-sales-performance";
import { INTL_LOCALE_MAP, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

/** Locale-correct short month name from a 0-indexed month, matching components/ui/date-input.tsx's convention. Reference year is arbitrary — only the month component is used. */
function shortMonthLabel(monthIndex: number, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE_MAP[locale], { month: "short" }).format(
    new Date(Date.UTC(2000, monthIndex, 1)),
  );
}

export async function SalesPerformance({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const { value, unit, trendValue, months } = await getSalesPerformance();
  const maxPct = Math.max(...months.map((m) => m.pct));
  const t = dictionary.commandCenter.salesPerformance;

  const monthLabels = months.map((m) => shortMonthLabel(m.monthIndex, locale));
  const firstMonthLabel = monthLabels[0];
  const lastMonthLabel = monthLabels[monthLabels.length - 1];
  const summary = `${t.summary.monthlySales} ${firstMonthLabel} ${t.summary.through} ${lastMonthLabel}, ${t.summary.trendingUp}, ${lastMonthLabel} ${t.summary.highestAt} ${trendValue} ${dictionary.commandCenter.kpi.comparisonLabel}`;

  return (
    <AnalyticsCard
      title={t.title}
      action={
        <button
          type="button"
          aria-label={t.viewReportAriaLabel}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
        </button>
      }
    >
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[22px] leading-none font-semibold tracking-tight text-slate-900">
          {value}
        </span>
        <span className="text-[11.5px] leading-none font-medium text-slate-400">{unit}</span>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px]">
        <span className="inline-flex items-center gap-0.5 font-medium text-emerald-600">
          <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
          {trendValue}
        </span>
        <span className="text-slate-400">{dictionary.commandCenter.kpi.comparisonLabel}</span>
      </div>

      <div className="mt-auto pt-2" role="img" aria-label={summary}>
        <div
          className="flex items-end gap-[5px] border-b border-slate-100"
          style={{ height: 58 }}
          aria-hidden="true"
        >
          {months.map((m, i) => {
            const isCurrent = i === months.length - 1;
            return (
              <div key={m.monthIndex} className="flex h-full flex-1 items-end">
                <div
                  className={cn("w-full rounded-t-[3px]", isCurrent ? "bg-blue-500" : "bg-slate-200")}
                  style={{ height: `${(m.pct / maxPct) * 100}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-[5px]" aria-hidden="true">
          {months.map((m, i) => {
            const isCurrent = i === months.length - 1;
            return (
              <span
                key={m.monthIndex}
                className={cn(
                  "flex-1 text-center text-[9.5px]",
                  isCurrent ? "font-semibold text-blue-600" : "text-slate-400",
                )}
              >
                {monthLabels[i]}
              </span>
            );
          })}
        </div>
      </div>
    </AnalyticsCard>
  );
}
