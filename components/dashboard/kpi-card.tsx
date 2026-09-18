import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  KpiAccent,
  KpiTrendDirection,
  KpiTrendSentiment,
} from "@/components/dashboard/kpi-data";

const accentChipStyles: Record<KpiAccent, string> = {
  mint: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  rose: "bg-rose-50 text-rose-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
  teal: "bg-teal-50 text-teal-600",
};

const sentimentTextStyles: Record<KpiTrendSentiment, string> = {
  positive: "text-emerald-600",
  negative: "text-rose-600",
  neutral: "text-slate-500",
};

type KpiCardProps = {
  label: string;
  value: string;
  unit?: string;
  trendValue: string;
  trendDirection: KpiTrendDirection;
  trendSentiment: KpiTrendSentiment;
  comparisonLabel: string;
  icon: LucideIcon;
  accent: KpiAccent;
};

export function KpiCard({
  label,
  value,
  unit,
  trendValue,
  trendDirection,
  trendSentiment,
  comparisonLabel,
  icon: Icon,
  accent,
}: KpiCardProps) {
  const TrendIcon = trendDirection === "up" ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
            accentChipStyles[accent],
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
        {/*
          min-w-0 flex-1: without this, a flex item's default min-width:auto
          floors it at its unwrapped content width, so line-clamp-2 never
          gets a chance to actually wrap the text into two lines — it just
          renders (or clips) as if it were a single line. This is the exact
          cause of the reported KPI-label truncation; KpiRow below already
          had the equivalent fix (min-w-0 flex-1) on its own label.
        */}
        <p className="line-clamp-2 min-w-0 flex-1 pt-1 text-[13px] leading-[1.25] font-medium text-slate-500">
          {label}
        </p>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[22px] leading-none font-semibold whitespace-nowrap tracking-tight text-slate-900">
          {value}
        </span>
        {unit ? (
          <span className="text-[11.5px] leading-none font-medium whitespace-nowrap text-slate-400">
            {unit}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px]">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 font-medium whitespace-nowrap",
            sentimentTextStyles[trendSentiment],
          )}
        >
          <TrendIcon className="h-3 w-3" strokeWidth={2} />
          {trendValue}
        </span>
        <span className="whitespace-nowrap text-slate-400">{comparisonLabel}</span>
      </div>
    </div>
  );
}

/**
 * Mobile-only (<768px) compact row variant of the same KPI, used inside a
 * single summary card instead of the tile grid. Full row width means the
 * value + unit never compete for space, so nothing here needs to shrink or
 * wrap — same data, same colors, same icon, just a different layout.
 */
export function KpiRow({
  label,
  value,
  unit,
  trendValue,
  trendDirection,
  trendSentiment,
  comparisonLabel,
  icon: Icon,
  accent,
}: KpiCardProps) {
  const TrendIcon = trendDirection === "up" ? ArrowUpRight : ArrowDownRight;

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

      {/* line-clamp-2 (not truncate): same reasoning as KpiCard above — prefer showing the complete label on up to two lines over a single-line ellipsis. min-w-0 flex-1 was already correct here. */}
      <p className="line-clamp-2 min-w-0 flex-1 text-[13px] font-medium text-slate-500">{label}</p>

      <div className="shrink-0 text-right">
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
        <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[11.5px]">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium whitespace-nowrap",
              sentimentTextStyles[trendSentiment],
            )}
          >
            <TrendIcon className="h-3 w-3" strokeWidth={2} />
            {trendValue}
          </span>
          <span className="whitespace-nowrap text-slate-400">{comparisonLabel}</span>
        </div>
      </div>
    </div>
  );
}
