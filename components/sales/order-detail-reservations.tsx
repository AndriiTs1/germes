"use client";

import { useActionState, useState } from "react";
import {
  createStockReservationAction,
  releaseStockReservationAction,
  type ReservationActionState,
} from "@/app/sales/orders/[id]/actions";
import { DetailSection } from "@/components/sales/detail-section";
import { Select } from "@/components/ui/select";
import { formatKg, formatShortDate } from "@/components/sales/format";
import {
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUS_STYLES,
} from "@/components/sales/reservation-status";
import type { SalesOrderDetailReservation } from "@/lib/services/sales/get-sales-order-detail";
import { cn } from "@/lib/utils";

export type ReservationAvailabilityItem = {
  salesOrderItemId: string;
  productName: string;
  orderedQuantityKg: string;
  allocations: {
    batchId: string;
    batchNumber: string;
    warehouseId: string;
    warehouseCode: string;
    warehouseName: string;
    availableKg: string;
  }[];
};

const INITIAL_STATE: ReservationActionState = {
  ok: false,
  message: null,
};

function CreateReservationForm({
  orderId,
  item,
}: {
  orderId: string;
  item: ReservationAvailabilityItem;
}) {
  const [state, action, pending] = useActionState(
    createStockReservationAction,
    INITIAL_STATE,
  );
  const [allocation, setAllocation] = useState("");

  const usableAllocations = item.allocations.filter(
    (candidate) => Number(candidate.availableKg) > 0,
  );

  const allocationOptions = usableAllocations.map((candidate) => ({
    value: `${candidate.batchId}:${candidate.warehouseId}`,
    label: `${candidate.batchNumber} · ${candidate.warehouseCode} · ${formatKg(candidate.availableKg)} kg available`,
  }));

  return (
    <form
      action={action}
      className="rounded-xl border border-slate-100 bg-slate-50/50 p-3"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input
        type="hidden"
        name="salesOrderItemId"
        value={item.salesOrderItemId}
      />

      <div className="mb-2">
        <p className="text-[13px] font-medium text-slate-900">
          {item.productName}
        </p>
        <p className="text-[11px] text-slate-400">
          Ordered {formatKg(item.orderedQuantityKg)} kg
        </p>
      </div>

      {usableAllocations.length > 0 ? (
        <div className="grid gap-2 min-[700px]:grid-cols-[1fr_150px_auto]">
          <div className="min-w-0">
            <Select
              value={allocation}
              onValueChange={setAllocation}
              options={allocationOptions}
              placeholder="Select batch / warehouse"
              aria-label={`Batch and warehouse for ${item.productName}`}
              error={!state.ok && state.message === "Select a batch and warehouse."}
            />
            <input type="hidden" name="allocation" value={allocation} />
          </div>

          <input
            name="quantityKg"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Quantity kg"
            className="h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10"
          />

          <button
            type="submit"
            disabled={pending}
            className="h-9 rounded-lg bg-slate-900 px-4 text-[12px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Reserving..." : "Reserve"}
          </button>
        </div>
      ) : (
        <p className="text-[11.5px] text-amber-600">
          No available batch / warehouse stock for this item.
        </p>
      )}

      {state.message ? (
        <p
          className={cn(
            "mt-2 text-[11px] font-medium",
            state.ok ? "text-emerald-600" : "text-rose-600",
          )}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function ReleaseReservationButton({
  orderId,
  reservationId,
}: {
  orderId: string;
  reservationId: string;
}) {
  const [state, action, pending] = useActionState(
    releaseStockReservationAction,
    INITIAL_STATE,
  );

  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="reservationId" value={reservationId} />

      <button
        type="submit"
        disabled={pending}
        className="text-[11px] font-semibold text-rose-600 transition-opacity hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Releasing..." : "Release"}
      </button>

      {state.message && !state.ok ? (
        <p className="mt-1 text-[10.5px] font-medium text-rose-600">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function OrderDetailReservations({
  orderId,
  reservations,
  availability,
  canCreate,
  canRelease,
  className,
}: {
  orderId: string;
  reservations: SalesOrderDetailReservation[];
  availability: ReservationAvailabilityItem[];
  canCreate: boolean;
  canRelease: boolean;
  className?: string;
}) {
  return (
    <DetailSection title="Reservations" className={className}>
      {canCreate ? (
        <div className="mb-3 flex flex-col gap-2">
          {availability.map((item) => (
            <CreateReservationForm
              key={item.salesOrderItemId}
              orderId={orderId}
              item={item}
            />
          ))}
        </div>
      ) : null}

      {reservations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center">
          <p className="text-[13px] font-medium text-slate-700">
            No reservations yet
          </p>
          <p className="mt-1 text-[11.5px] text-slate-400">
            Reserved stock for this order will appear here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {reservations.map((reservation) => (
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
                    : reservation.warehouseName ??
                      reservation.warehouseCode ??
                      "Not linked"}
                </p>

                {reservation.expiresAt ? (
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Expires {formatShortDate(reservation.expiresAt)}
                  </p>
                ) : null}

                {canRelease && reservation.status === "ACTIVE" ? (
                  <ReleaseReservationButton
                    orderId={orderId}
                    reservationId={reservation.id}
                  />
                ) : null}
              </div>

              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap",
                  RESERVATION_STATUS_STYLES[reservation.status] ??
                    "bg-slate-100 text-slate-600",
                )}
              >
                {RESERVATION_STATUS_LABELS[reservation.status] ??
                  reservation.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DetailSection>
  );
}
