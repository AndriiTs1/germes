import { DetailSection } from "@/components/sales/detail-section";
import { formatKg, formatShortDate } from "@/components/sales/format";
import {
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUS_STYLES,
} from "@/components/sales/reservation-status";
import type { SalesOrderDetailReservation } from "@/lib/services/sales/get-sales-order-detail";
import { cn } from "@/lib/utils";

/**
 * An ACTIVE reservation whose expiresAt has already passed is still
 * ACTIVE in the database (no expiration job exists yet — see Stage 8C
 * history). The real status is always shown as-is; isExpiredWhileActive
 * (computed server-side in the service, not here, to avoid an impure
 * Date.now() call during render) adds a secondary warning line instead
 * of ever relabeling the status itself.
 */
export function OrderDetailReservations({
  reservations,
  className,
}: {
  reservations: SalesOrderDetailReservation[];
  className?: string;
}) {
  return (
    <DetailSection title="Reservations" className={className}>
      <ul className="flex flex-col gap-2">
        {reservations.map((reservation) => (
          <li
            key={reservation.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-slate-900">
                {reservation.productName}
              </p>
              <p className="text-[11.5px] text-slate-400">
                {formatKg(reservation.quantityKg)} kg
                {reservation.expiresAt
                  ? ` · Expires ${formatShortDate(reservation.expiresAt)}`
                  : ""}
              </p>
              {reservation.isExpiredWhileActive ? (
                <p className="mt-0.5 text-[11px] font-medium text-rose-600">
                  Expired while active
                </p>
              ) : null}
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap",
                RESERVATION_STATUS_STYLES[reservation.status] ?? "bg-slate-100 text-slate-600",
              )}
            >
              {RESERVATION_STATUS_LABELS[reservation.status] ?? reservation.status}
            </span>
          </li>
        ))}
      </ul>
    </DetailSection>
  );
}
