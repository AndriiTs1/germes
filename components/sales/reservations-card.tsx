import { Clock3 } from "lucide-react";

import { OperationsCard } from "@/components/dashboard/operations/operations-card";
import { formatKg, formatShortDate } from "@/components/sales/format";
import { PreviewList } from "@/components/sales/preview-list";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type {
  ReservationAttentionItem,
  ReservationAttentionState,
} from "@/lib/services/sales/get-reservations-requiring-attention";
import { cn } from "@/lib/utils";

const attentionStyles: Record<ReservationAttentionState, string> = {
  EXPIRED_ACTIVE: "bg-rose-50 text-rose-600",
  EXPIRING_SOON: "bg-amber-50 text-amber-600",
  ACTIVE: "bg-slate-100 text-slate-500",
};

const LIST_CLASS = "flex flex-1 flex-col gap-1 overflow-y-auto xl:gap-0 xl:divide-y xl:divide-slate-100";

const PREVIEW_LIMIT = 5;

/**
 * `compact` (supervisory /sales): counters per attention state, then only the
 * first PREVIEW_LIMIT problem rows (expired, then expiring soon — the
 * service's existing order), with an in-place "show all" over the full,
 * already-loaded list. Without it every reservation is listed (manager
 * workspace).
 */
export function ReservationsCard({
  reservations,
  locale,
  dictionary,
  className,
  compact = false,
}: {
  reservations: ReservationAttentionItem[];
  locale: Locale;
  dictionary: Dictionary;
  className?: string;
  compact?: boolean;
}) {
  const labels = dictionary.sales.reservationsCard;
  const attentionLabels: Record<ReservationAttentionState, string> = {
    EXPIRED_ACTIVE: labels.expiredLabel,
    EXPIRING_SOON: labels.expiringSoonLabel,
    ACTIVE: labels.activeLabel,
  };

  const renderItem = (reservation: ReservationAttentionItem) => (
    <li key={reservation.id}>
      <div className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-slate-900">
            {reservation.productName}
          </p>
          <p className="truncate text-[11px] text-slate-400">
            {reservation.customerName} · {reservation.orderNumber} ·{" "}
            {formatKg(reservation.quantityKg, locale)} {dictionary.common.kgUnit}
          </p>
          {reservation.expiresAt ? (
            <p className="truncate text-[10.5px] text-slate-400">
              {dictionary.common.expiresLabel} {formatShortDate(reservation.expiresAt, locale)}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap",
            attentionStyles[reservation.attentionState],
          )}
        >
          {attentionLabels[reservation.attentionState]}
        </span>
      </div>
    </li>
  );

  if (reservations.length === 0) {
    return (
      <OperationsCard title={labels.title} className={className}>
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-6 text-center">
          <Clock3 className="h-5 w-5 text-slate-300 xl:h-4 xl:w-4" strokeWidth={1.75} />
          <p className="text-[12.5px] font-medium text-slate-500 xl:text-[12px]">{labels.empty}</p>
        </div>
      </OperationsCard>
    );
  }

  if (!compact) {
    return (
      <OperationsCard title={labels.title} className={className}>
        <ul className={LIST_CLASS}>{reservations.map(renderItem)}</ul>
      </OperationsCard>
    );
  }

  const countOf = (state: ReservationAttentionState) =>
    reservations.filter((reservation) => reservation.attentionState === state).length;
  const counters: { state: ReservationAttentionState; label: string; count: number }[] = [
    { state: "EXPIRED_ACTIVE", label: labels.counters.expired, count: countOf("EXPIRED_ACTIVE") },
    { state: "EXPIRING_SOON", label: labels.counters.expiringSoon, count: countOf("EXPIRING_SOON") },
    { state: "ACTIVE", label: labels.counters.active, count: countOf("ACTIVE") },
  ];
  const problems = reservations.filter((reservation) => reservation.attentionState !== "ACTIVE");

  return (
    <OperationsCard title={labels.title} className={className}>
      <ul className="mb-2 flex flex-wrap gap-1.5">
        {counters.map((counter) => (
          <li
            key={counter.state}
            className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", attentionStyles[counter.state])}
          >
            {counter.label}: {counter.count}
          </li>
        ))}
      </ul>
      <PreviewList
        preview={problems.slice(0, PREVIEW_LIMIT).map(renderItem)}
        full={reservations.map(renderItem)}
        showAllLabel={dictionary.sales.workspace.preview.showAll.replace("{count}", String(reservations.length))}
        collapseLabel={dictionary.sales.workspace.preview.collapse}
        emptyPreview={<p className="px-2 py-2 text-[12px] font-medium text-slate-500">{labels.noProblems}</p>}
        className={LIST_CLASS}
      />
    </OperationsCard>
  );
}
