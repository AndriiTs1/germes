import { AnalyticsCard } from "@/components/dashboard/analytics/analytics-card";
import { cashFlow } from "@/components/dashboard/analytics/analytics-data";
import { buildSmoothLinePath } from "@/components/dashboard/analytics/chart-utils";
import { INTL_LOCALE_MAP, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

const VIEW_W = 240;
const VIEW_H = 72;
const PADDING_Y = 6;

export function CashFlow({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const { value, unit, monthIndex, year, points } = cashFlow;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const stepX = VIEW_W / (points.length - 1);

  const coords = points.map((p, i) => ({
    x: Number((i * stepX).toFixed(2)),
    y: Number(
      (VIEW_H - PADDING_Y - ((p - min) / range) * (VIEW_H - PADDING_Y * 2)).toFixed(2),
    ),
  }));

  const linePath = buildSmoothLinePath(coords);
  const lastPoint = coords[coords.length - 1];
  const firstPoint = coords[0];
  const areaPath = `${linePath} L ${lastPoint.x} ${VIEW_H} L ${firstPoint.x} ${VIEW_H} Z`;

  const t = dictionary.commandCenter.cashFlow;
  // Locale-correct short month name from the 0-indexed monthIndex, matching
  // components/ui/date-input.tsx's convention — the demo period itself
  // (September 2026) is unchanged, only how the month name displays.
  const monthLabel = new Intl.DateTimeFormat(INTL_LOCALE_MAP[locale], { month: "short" }).format(
    new Date(Date.UTC(year, monthIndex, 1)),
  );
  const secondaryLabel = `${t.netForLabel} ${monthLabel} ${year}`;

  return (
    <AnalyticsCard title={t.title} className="h-[180px] md:h-[210px]">
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[22px] leading-none font-semibold tracking-tight text-slate-900">
          {value}
        </span>
        <span className="text-[11.5px] leading-none font-medium text-slate-400">{unit}</span>
      </div>
      <p className="mt-1 text-[11.5px] text-slate-400">{secondaryLabel}</p>

      <div className="mt-auto pt-2" role="img" aria-label={t.trendAriaLabel}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="h-[70px] w-full overflow-visible md:h-[64px]"
          aria-hidden="true"
        >
          <path d={areaPath} className="fill-emerald-500/10" stroke="none" />
          <path
            d={linePath}
            className="fill-none stroke-emerald-600"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </AnalyticsCard>
  );
}
