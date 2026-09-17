import { Clock3 } from "lucide-react";

import { OperationsCard } from "@/components/dashboard/operations/operations-card";
import { formatKg, formatShortDate } from "@/components/sales/format";
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

export function ReservationsCard({
  reservations,
  locale,
  dictionary,
  className,
}: {
  reservations: ReservationAttentionItem[];
  locale: Locale;
  dictionary: Dictionary;
  className?: string;
}) {
  const attentionLabels: Record<ReservationAttentionState, string> = {
    EXPIRED_ACTIVE: dictionary.sales.reservationsCard.expiredLabel,
    EXPIRING_SOON: dictionary.sales.reservationsCard.expiringSoonLabel,
    ACTIVE: dictionary.sales.reservationsCard.activeLabel,
  };

  return (
    <OperationsCard title={dictionary.sales.reservationsCard.title} className={className}>
      {reservations.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-6 text-center">
          <Clock3 className="h-5 w-5 text-slate-300 xl:h-4 xl:w-4" strokeWidth={1.75} />
          <p className="text-[12.5px] font-medium text-slate-500 xl:text-[12px]">
            {dictionary.sales.reservationsCard.empty}
          </p>
        </div>
      ) : (
        <ul className="flex flex-1 flex-col gap-1 overflow-y-auto xl:gap-0 xl:divide-y xl:divide-slate-100">
          {reservations.map((reservation) => (
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
          ))}
        </ul>
      )}
    </OperationsCard>
  );
}
