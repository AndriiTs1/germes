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
        <p className="line-clamp-2 pt-1 text-[13px] leading-[1.25] font-medium text-slate-500">
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
