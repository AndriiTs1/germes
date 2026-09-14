import { formatKg, formatShortDate } from "@/components/sales/format";
import { DetailSection } from "@/components/sales/detail-section";
import {
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUS_STYLES,
} from "@/components/sales/reservation-status";
import type { WarehouseOrderDetailReservation } from "@/lib/services/warehouse/get-warehouse-order-detail";
import { cn } from "@/lib/utils";

type WarehouseOrderReservationsProps = {
  reservations: WarehouseOrderDetailReservation[];
};

/**
 * READ-ONLY: no Create/Release controls — Warehouse must never receive
 * Sales reservation mutation controls. A reservation's real, literal status
 * is always shown (never relabeled) via the same RESERVATION_STATUS_LABELS/
 * STYLES used on the Sales detail page. For CONFIRMED/PROCESSING/READY
 * orders, an ACTIVE reservation whose expiresAt has already passed is still
 * shown as "Active" (that IS its real status — this route never mutates
 * it) but flagged with a plain-language note that it no longer counts as
 * usable fulfillment, matching the "evaluate, never mutate" truth already
 * enforced by getWarehouseOrderDetail. For SHIPPED orders, CONSUMED rows
 * are expected historical fulfillment, not a failure — they render with
 * their own (positive) status color, no elapsed note.
 */
export function WarehouseOrderReservations({ reservations }: WarehouseOrderReservationsProps) {
  const now = new Date();

  return (
    <DetailSection title="Reservations">
      {reservations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center">
          <p className="text-[13px] font-medium text-slate-700">No reservations yet</p>
          <p className="mt-1 text-[11.5px] text-slate-400">
            Reserved stock for this order will appear here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {reservations.map((reservation) => {
            const isElapsedActive =
              reservation.status === "ACTIVE" &&
              reservation.expiresAt !== null &&
              new Date(reservation.expiresAt) <= now;

            return (
              <li
                key={reservation.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-900">
                    {reservation.productName}
                  </p>

                  <p className="text-[11.5px] text-slate-500">
                    {formatKg(reservation.quantityKg)} kg
                  </p>

                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Batch: {reservation.batchNumber ?? "Not linked"}
                  </p>

                  <p className="text-[11px] text-slate-400">
                    Warehouse:{" "}
                    {reservation.warehouseCode && reservation.warehouseName
                      ? `${reservation.warehouseCode} · ${reservation.warehouseName}`
                      : (reservation.warehouseName ?? reservation.warehouseCode ?? "Not linked")}
                  </p>

                  {reservation.expiresAt ? (
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Expires {formatShortDate(reservation.expiresAt)}
                    </p>
                  ) : null}

                  {isElapsedActive ? (
                    <p className="mt-1 text-[11px] font-medium text-rose-600">
                      Elapsed — no longer counted as usable fulfillment
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
            );
          })}
        </ul>
      )}
    </DetailSection>
  );
}
