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

/** A real period-over-period comparison. Omitted = no trend row is rendered at all. */
export type KpiTrend = {
  value: string;
  direction: KpiTrendDirection;
  sentiment: KpiTrendSentiment;
  comparisonLabel: string;
};

/** A few labelled parts of the headline value (e.g. active orders by status), shown as one compact wrapping line. */
export type KpiBreakdown = {
  /** Accessible name of the list, e.g. "Active orders by status". */
  label: string;
  items: { key: string; label: string; value: string }[];
};

type KpiCardProps = {
  label: string;
  /** One line, or one line per currency (never summed); extra lines render smaller. */
  value: string | string[];
  unit?: string;
  trend?: KpiTrend;
  breakdown?: KpiBreakdown;
  icon: LucideIcon;
  accent: KpiAccent;
};

function KpiBreakdownList({ breakdown, className }: { breakdown: KpiBreakdown; className?: string }) {
  return (
    <ul aria-label={breakdown.label} className={cn("flex flex-wrap gap-x-4 gap-y-1 text-[12px] leading-tight", className)}>
      {breakdown.items.map((item) => (
        <li key={item.key} className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-slate-500">{item.label}</span>
          <span className="font-semibold tabular-nums text-slate-900">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function KpiCard({
  label,
  value,
  unit,
  trend,
  breakdown,
  icon: Icon,
  accent,
}: KpiCardProps) {
  const TrendIcon = trend?.direction === "up" ? ArrowUpRight : ArrowDownRight;
  const [primaryValue, ...extraValues] = Array.isArray(value) ? value : [value];

  return (
    // Desktop tile: the whole content block is centred both ways — flex-col
    // + justify-center (vertically, also when a taller neighbour stretches
    // the grid row) + items-center/text-center (horizontally). The mobile
    // KpiRow below stays left-aligned.
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/70 bg-white px-5 py-4 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]">
      {/* Icon + label as one centred header; max-w-full keeps it inside the card. */}
      <div className="flex max-w-full items-center justify-center gap-2.5">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
            accentChipStyles[accent],
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
        {/*
          min-w-0: without it a flex item's default min-width:auto floors it
          at its unwrapped content width, so line-clamp-2 never gets to wrap
          the text into two lines (the old KPI-label truncation bug). No
          flex-1 here: the label takes only its own width, so icon + label
          centre together; a long label still wraps, each line centred.
        */}
        <p className="line-clamp-2 min-w-0 text-[13px] leading-[1.25] font-medium text-slate-500">
          {label}
        </p>
      </div>

      <div className="mt-3 flex items-baseline justify-center gap-1.5">
        <span className="text-[22px] leading-none font-semibold whitespace-nowrap tracking-tight text-slate-900">
          {primaryValue}
        </span>
        {unit ? (
          <span className="text-[11.5px] leading-none font-medium whitespace-nowrap text-slate-400">
            {unit}
          </span>
        ) : null}
      </div>
      {extraValues.map((extra) => (
        <p key={extra} className="mt-1 text-[15px] leading-tight font-semibold whitespace-nowrap tracking-tight text-slate-900">
          {extra}
        </p>
      ))}

      {breakdown ? <KpiBreakdownList breakdown={breakdown} className="mt-2.5 justify-center" /> : null}

      {trend ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[11.5px]">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium whitespace-nowrap",
              sentimentTextStyles[trend.sentiment],
            )}
          >
            <TrendIcon className="h-3 w-3" strokeWidth={2} />
            {trend.value}
          </span>
        {/*
          basis-full: forces the comparison text onto its own flex-wrap
          line, every time, so it always gets the card's full content width
          to wrap within — never squeezed onto the trend badge's line and
          never allowed to overflow past the card edge the way an
          un-wrapped "по сравнению с прошлым месяцем" did before.
          line-clamp-2 caps it at the "2 lines is acceptable" limit.
        */}
          <span className="line-clamp-2 min-w-0 basis-full text-slate-400">{trend.comparisonLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Mobile-only (<768px) compact row variant of the same KPI, used inside a
 * single summary card instead of the tile grid.
 *
 * Previously this put the label and a `shrink-0` value/trend/comparison
 * block on one horizontal line — since that right-hand block never shrinks
 * and its own comparison text was `whitespace-nowrap`, a long RU/UK
 * comparison sentence forced that block very wide and left the label only
 * a sliver of the row (the "Ден / ср..." fragment bug). The label now gets
 * its own full-width top zone instead of sharing width with the value at
 * all — value/trend share one row below it, and comparison gets its own
 * wrapping line — so the label always has the row's full width to wrap
 * into up to two lines, matching KpiCard's behavior one column above it.
 */
export function KpiRow({
  label,
  value,
  unit,
  trend,
  breakdown,
  icon: Icon,
  accent,
}: KpiCardProps) {
  const TrendIcon = trend?.direction === "up" ? ArrowUpRight : ArrowDownRight;
  const [primaryValue, ...extraValues] = Array.isArray(value) ? value : [value];

  return (
    <div className="flex items-start gap-2.5 px-4 py-3">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
          accentChipStyles[accent],
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] font-medium text-slate-500">{label}</p>

        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[22px] leading-none font-semibold whitespace-nowrap tracking-tight text-slate-900">
              {primaryValue}
            </span>
            {unit ? (
              <span className="text-[11.5px] leading-none font-medium whitespace-nowrap text-slate-400">
                {unit}
              </span>
            ) : null}
          </div>
          {trend ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 text-[11.5px] font-medium whitespace-nowrap",
                sentimentTextStyles[trend.sentiment],
              )}
            >
              <TrendIcon className="h-3 w-3" strokeWidth={2} />
              {trend.value}
            </span>
          ) : null}
        </div>

        {extraValues.map((extra) => (
          <p key={extra} className="mt-0.5 text-[15px] leading-tight font-semibold whitespace-nowrap tracking-tight text-slate-900">
            {extra}
          </p>
        ))}

        {breakdown ? <KpiBreakdownList breakdown={breakdown} className="mt-1.5" /> : null}

        {trend ? <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">{trend.comparisonLabel}</p> : null}
      </div>
    </div>
  );
}
