import { AnalyticsCard } from "@/components/dashboard/analytics/analytics-card";
import { getInventoryStatus } from "@/lib/services/dashboard/get-inventory-status";
import type { ChartAccent, InventorySegmentKey } from "@/components/dashboard/analytics/analytics-data";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

const RING_SIZE = 92;
const STROKE = 11;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const accentStyles: Record<ChartAccent, { stroke: string; dot: string }> = {
  mint: { stroke: "stroke-emerald-500", dot: "bg-emerald-500" },
  blue: { stroke: "stroke-blue-500", dot: "bg-blue-500" },
  amber: { stroke: "stroke-amber-500", dot: "bg-amber-500" },
  rose: { stroke: "stroke-rose-500", dot: "bg-rose-500" },
};

export async function InventoryStatus({ dictionary }: { dictionary: Dictionary }) {
  const { value, segments } = await getInventoryStatus();
  const t = dictionary.commandCenter.inventoryStatus;
  const segmentLabel = (key: InventorySegmentKey) => t.segments[key];
  const summary = segments.map((s) => `${segmentLabel(s.key)} ${s.pct}%`).join(", ");

  return (
    <AnalyticsCard title={t.title}>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[22px] leading-none font-semibold tracking-tight text-slate-900">
          {value}
        </span>
      </div>
      <p className="mt-1 text-[11.5px] text-slate-400">{t.unitsInStock}</p>

      <div className="mt-auto flex items-center gap-4 pt-2">
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="-rotate-90 shrink-0"
          role="img"
          aria-label={`${t.breakdownAriaLabel} ${summary}`}
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            strokeWidth={STROKE}
            className="fill-none stroke-slate-100"
          />
          {segments.map((segment, index) => {
            const cumulativePct = segments
              .slice(0, index)
              .reduce((sum, s) => sum + s.pct, 0);
            const dash = (segment.pct / 100) * CIRCUMFERENCE;
            const offset = -(cumulativePct / 100) * CIRCUMFERENCE;
            return (
              <circle
                key={segment.key}
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                strokeDashoffset={offset}
                className={cn("fill-none", accentStyles[segment.accent].stroke)}
              />
            );
          })}
        </svg>

        <ul className="min-w-0 flex-1 space-y-1.5">
          {segments.map((segment) => (
            <li key={segment.key} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
                <span
                  className={cn("h-1.5 w-1.5 shrink-0 rounded-full", accentStyles[segment.accent].dot)}
                />
                <span className="truncate">{segmentLabel(segment.key)}</span>
              </span>
              <span className="shrink-0 font-medium text-slate-900">{segment.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </AnalyticsCard>
  );
}
