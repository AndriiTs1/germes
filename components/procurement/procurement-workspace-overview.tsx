import { AlertTriangle, CalendarClock, CheckCircle2, FileText, Package, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { formatKg, formatShortDate } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { pluralize } from "@/lib/i18n/pluralize";
import type {
  ProcurementAttentionReason,
  ProcurementWorkspaceOverview as OverviewData,
} from "@/lib/services/procurement/get-procurement-workspace-overview";
import { cn } from "@/lib/utils";

const CARD =
  "rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]";
const SECTION_TITLE = "text-[13.5px] font-semibold tracking-tight text-slate-900";
const ROW_LINK =
  "block px-4 py-3 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none focus-visible:ring-inset";

type Accent = "amber" | "slate" | "blue" | "violet" | "emerald";

const ACCENT_CHIP: Record<Accent, string> = {
  amber: "bg-amber-50 text-amber-600",
  slate: "bg-slate-100 text-slate-500",
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  emerald: "bg-emerald-50 text-emerald-600",
};

type ReportCard = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  /** Neutral second line (e.g. the kg behind a count) — never a warning. */
  secondary?: string;
  icon: LucideIcon;
  accent: Accent;
};

/** Same card language as the Sales KPI cards (border, radius, shadow, icon chip, value/unit type), without trends. */
function ReportCardView({ label, value, unit, secondary, icon: Icon, accent }: ReportCard) {
  return (
    <div className={cn(CARD, "px-4 py-3.5")}>
      <div className="flex items-start gap-2.5">
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]", ACCENT_CHIP[accent])}>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <p className="line-clamp-2 pt-1 text-[13px] leading-[1.25] font-medium text-slate-500">{label}</p>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[22px] leading-none font-semibold tracking-tight whitespace-nowrap text-slate-900">
          {value}
        </span>
        {unit ? (
          <span className="text-[11.5px] leading-none font-medium whitespace-nowrap text-slate-400">{unit}</span>
        ) : null}
      </div>
      {secondary ? (
        <p className="mt-1.5 truncate text-[11.5px] text-slate-400">{secondary}</p>
      ) : (
        <div className="mt-1.5 h-[15px]" aria-hidden="true" />
      )}
    </div>
  );
}

/**
 * Procurement report: five always-visible metric cards (zero is valid
 * report data), then the detailed "requires attention" and "upcoming
 * planned arrivals" lists — each only when it has rows. No
 * create/edit/confirm/cancel controls; rows only link to the PurchaseOrder
 * they describe. Every figure comes pre-computed from the service.
 */
export function ProcurementWorkspaceOverview({
  overview,
  locale,
  dictionary,
}: {
  overview: OverviewData;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const t = dictionary.procurement.overview;
  const kg = dictionary.common.kgUnit;

  const cards: ReportCard[] = [
    {
      key: "attention",
      label: t.metrics.attention,
      value: String(overview.attention.totalCount),
      icon: AlertTriangle,
      accent: "amber",
    },
    { key: "drafts", label: t.metrics.drafts, value: String(overview.draftCount), icon: FileText, accent: "slate" },
    {
      key: "confirmed",
      label: t.metrics.confirmed,
      value: String(overview.confirmedCount),
      icon: CheckCircle2,
      accent: "blue",
    },
    {
      key: "ordered",
      label: t.metrics.ordered,
      value: formatKg(overview.orderedQuantityKg, locale),
      unit: kg,
      secondary: t.metrics.orderedHint,
      icon: Package,
      accent: "violet",
    },
    {
      key: "planned",
      label: t.metrics.planned,
      value: String(overview.plannedArrivalCount),
      unit: pluralize(locale, overview.plannedArrivalCount, t.metrics.ordersUnit),
      secondary: `${formatKg(overview.plannedArrivalQuantityKg, locale)} ${kg}`,
      icon: CalendarClock,
      accent: "emerald",
    },
  ];

  const reasonLabels: Record<ProcurementAttentionReason, string> = {
    MISSING_PRICE: t.attention.reasons.missingPrice,
    MISSING_WAREHOUSE: t.attention.reasons.missingWarehouse,
    MISSING_EXPECTED_ARRIVAL: t.attention.reasons.missingExpectedArrival,
  };

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="procurement-metrics-title">
        <h2 id="procurement-metrics-title" className={cn(SECTION_TITLE, "mb-3")}>
          {t.metrics.title}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {cards.map(({ key, ...card }) => (
            <ReportCardView key={key} {...card} />
          ))}
        </div>
      </section>

      {overview.attention.totalCount > 0 ? (
        <section aria-labelledby="procurement-attention-title" className={CARD}>
          <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
            <h2 id="procurement-attention-title" className={SECTION_TITLE}>
              {t.attention.title}
            </h2>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-50 px-1.5 text-[11px] font-semibold text-amber-700">
              {overview.attention.totalCount}
            </span>
          </div>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {overview.attention.items.map((item) => (
              <li key={item.id}>
                <Link href={`/procurement/orders/${item.id}`} className={ROW_LINK}>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                    <span className="shrink-0 text-[13px] font-semibold text-slate-900">{item.orderNumber}</span>
                    <span className="min-w-0 truncate text-[12.5px] text-slate-600">{item.supplierName}</span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-amber-700">
                    {item.reasons.map((reason) => reasonLabels[reason]).join(" · ")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          {overview.attention.totalCount > overview.attention.items.length ? (
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 text-[12px]">
              <span className="text-slate-400">
                {t.attention.shownOf
                  .replace("{shown}", String(overview.attention.items.length))
                  .replace("{total}", String(overview.attention.totalCount))}
              </span>
              <Link href="/procurement/orders" className="font-medium text-blue-600 hover:text-blue-700">
                {t.allOrders}
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {overview.plannedArrivals.length > 0 ? (
        <section aria-labelledby="procurement-arrivals-title" className={CARD}>
          <h2 id="procurement-arrivals-title" className={cn(SECTION_TITLE, "px-4 pt-4 pb-2")}>
            {t.arrivals.title}
          </h2>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {overview.plannedArrivals.map((arrival) => (
              <li key={arrival.id}>
                <Link href={`/procurement/orders/${arrival.id}`} className={ROW_LINK}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[13px] text-slate-900">
                      <span className="font-semibold">{formatShortDate(arrival.expectedArrivalDate, locale)}</span>
                      <span className="text-slate-400"> · </span>
                      {arrival.orderNumber}
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold whitespace-nowrap text-slate-900">
                      {formatKg(arrival.totalQuantityKg, locale)} {kg}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-slate-500">
                    {arrival.supplierName}
                    <span className="text-slate-300"> · </span>
                    {arrival.destinationWarehouseName ?? t.arrivals.noWarehouse}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
