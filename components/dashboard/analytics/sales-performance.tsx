import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { AnalyticsCard } from "@/components/dashboard/analytics/analytics-card";
import { formatKg, formatMoney } from "@/components/sales/format";
import {
  getSalesPerformance,
  type SalesMonth,
  type SalesPerformanceSeries,
  type SalesPerformanceTrend,
} from "@/lib/services/dashboard/get-sales-performance";
import { INTL_LOCALE_MAP, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

/** Locale-correct short month name ("Oct", "жовт"); the trailing abbreviation dot is dropped so 12 labels fit. */
function shortMonthLabel({ year, month }: SalesMonth, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE_MAP[locale], { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(/\.$/, "");
}

/** "Oct 2025" — used where the year matters (the screen-reader summary). */
function monthYearLabel({ year, month }: SalesMonth, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE_MAP[locale], { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

/** "+20%", "−12.5%", "0%" — locale digits, typographic minus. */
function formatTrend(trend: SalesPerformanceTrend, locale: Locale): string {
  const value = new Intl.NumberFormat(INTL_LOCALE_MAP[locale], { maximumFractionDigits: 1 }).format(
    Number(trend.percent),
  );
  const sign = trend.direction === "up" ? "+" : trend.direction === "down" ? "−" : "";
  return `${sign}${value}%`;
}

/** The currency the bars show: most shipped orders, ties broken by code (series is already code-ordered). */
function pickChartSeries(series: SalesPerformanceSeries[]): SalesPerformanceSeries | null {
  return series.reduce<SalesPerformanceSeries | null>(
    (best, entry) => (best === null || entry.orderCount > best.orderCount ? entry : best),
    null,
  );
}

const TREND_STYLES: Record<SalesPerformanceTrend["direction"], string> = {
  up: "text-emerald-600",
  down: "text-rose-600",
  flat: "text-slate-500",
};

export async function SalesPerformance({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const { months, series, trend } = await getSalesPerformance();
  const t = dictionary.commandCenter.salesPerformance;
  const comparisonLabel = dictionary.commandCenter.kpi.comparisonLabel;

  const chartSeries = pickChartSeries(series);
  // Charted currency first, then the rest by code — amounts are never added across currencies.
  const totals = chartSeries ? [chartSeries, ...series.filter((entry) => entry !== chartSeries)] : [];
  const [primaryTotal, ...extraTotals] = totals;

  // Bar heights are display-only; Number() never feeds back into any amount.
  const monthlyValues = months.map((_, index) => (chartSeries ? Number(chartSeries.monthly[index]) : 0));
  const maxValue = Math.max(...monthlyValues);
  const monthLabels = months.map((month) => shortMonthLabel(month, locale));

  const trendText = trend ? formatTrend(trend, locale) : null;
  const trendSentence = !trend
    ? t.summary.noTrend
    : trend.direction === "flat"
      ? `${t.summary.trendFlat} ${comparisonLabel}`
      : `${trend.direction === "up" ? t.summary.trendUp : t.summary.trendDown} ${trendText} ${comparisonLabel}`;
  const summary = [
    `${t.summary.shippedSales}${chartSeries ? `, ${chartSeries.currency}` : ""}`,
    `${monthYearLabel(months[0], locale)} ${t.summary.through} ${monthYearLabel(months[months.length - 1], locale)}`,
    trendSentence,
  ].join(", ");

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
          {primaryTotal ? formatKg(primaryTotal.total, locale) : "0"}
        </span>
        {primaryTotal ? (
          <span className="text-[11.5px] leading-none font-medium text-slate-400">{primaryTotal.currency}</span>
        ) : null}
      </div>
      {extraTotals.map((entry) => (
        <p
          key={entry.currency}
          className="mt-1 text-[13px] leading-tight font-semibold whitespace-nowrap tracking-tight text-slate-900"
        >
          {formatMoney(entry.total, entry.currency, locale)}
        </p>
      ))}

      {trend ? (
        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11.5px] whitespace-nowrap">
          <span className={cn("inline-flex shrink-0 items-center gap-0.5 font-medium", TREND_STYLES[trend.direction])}>
            {trend.direction === "up" ? <ArrowUpRight className="h-3 w-3" strokeWidth={2} /> : null}
            {trend.direction === "down" ? <ArrowDownRight className="h-3 w-3" strokeWidth={2} /> : null}
            {trendText}
          </span>
          <span className="min-w-0 truncate text-slate-400">{comparisonLabel}</span>
        </div>
      ) : null}

      <div className="mt-auto pt-2" role="img" aria-label={summary}>
        <div
          className="flex items-end gap-[3px] border-b border-slate-100"
          style={{ height: 58 }}
          aria-hidden="true"
        >
          {months.map((month, i) => {
            const isCurrent = i === months.length - 1;
            const heightPct = maxValue > 0 ? (monthlyValues[i] / maxValue) * 100 : 0;
            return (
              <div key={`${month.year}-${month.month}`} className="flex h-full min-w-0 flex-1 items-end">
                <div
                  className={cn("w-full rounded-t-[3px]", isCurrent ? "bg-blue-500" : "bg-slate-200")}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-[3px]" aria-hidden="true">
          {months.map((month, i) => {
            const isCurrent = i === months.length - 1;
            // On phones every other label is hidden (counting back from the
            // always-visible current month); the visible ones may then spill
            // into the empty neighbouring slot instead of being clipped.
            const hideOnPhone = (months.length - 1 - i) % 2 === 1;
            return (
              <span
                key={`${month.year}-${month.month}`}
                className={cn(
                  "min-w-0 flex-1 overflow-hidden text-center text-[9px] whitespace-nowrap max-[399px]:overflow-visible",
                  isCurrent ? "font-semibold text-blue-600 max-[399px]:text-right" : "text-slate-400",
                  hideOnPhone && "max-[399px]:invisible",
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
