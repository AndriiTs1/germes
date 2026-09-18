"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  markReadyAction,
  shipOrderAction,
  startProcessingAction,
  type WarehouseOrderActionState,
} from "@/app/warehouse/orders/[id]/actions";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type WarehouseOrderActionsProps = {
  orderId: string;
  status: string;
  /** Derived from inventory.shipments.process (RBAC Phase 2A) — distinct from the page's own inventory.shipments.read gate, so a viewer with read-only access (e.g. OWNER) can reach this page without seeing operational controls. */
  canProcess: boolean;
  dictionary: Dictionary["warehouse"]["orderDetail"]["actions"];
};

function reportResult(result: WarehouseOrderActionState) {
  if (!result.message) return;
  if (result.ok) {
    toast.success(result.message);
  } else {
    toast.error(result.message);
  }
}

/**
 * Renders exactly one lifecycle action for the order's current status —
 * CONFIRMED -> "Start processing", PROCESSING -> "Mark ready",
 * READY -> "Ship order", SHIPPED -> nothing (terminal for this route; no
 * reverse transitions, no COMPLETED). Mirrors OrderDetailActions'
 * useTransition + toast + hand-rolled confirmation-dialog pattern (same
 * role="dialog"/aria-modal/Escape/scrim-click/focus behavior), extended
 * with a "Confirm shipment" step: shipping is the one action with an
 * irreversible physical side effect (creates StockMovement, consumes
 * reservations), so it requires explicit confirmation first — Start
 * processing and Mark ready remain single-click, matching the spec's
 * instruction that only shipment needs a modal. The modal is UI
 * confirmation only; shipSalesOrder() remains the sole authority on
 * whether the order is actually still READY and safely shippable.
 */
export function WarehouseOrderActions({
  orderId,
  status,
  canProcess,
  dictionary,
}: WarehouseOrderActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const cancelShipButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!shipDialogOpen) return;

    cancelShipButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) {
        setShipDialogOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [shipDialogOpen, isPending]);

  useEffect(() => {
    if (!shipDialogOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [shipDialogOpen]);

  if (!canProcess) return null;

  const showStartProcessing = status === "CONFIRMED";
  const showMarkReady = status === "PROCESSING";
  const showShip = status === "READY";

  if (!showStartProcessing && !showMarkReady && !showShip) {
    return null;
  }

  function handleStartProcessing() {
    startTransition(async () => {
      const result = await startProcessingAction(orderId);
      reportResult(result);
    });
  }

  function handleMarkReady() {
    startTransition(async () => {
      const result = await markReadyAction(orderId);
      reportResult(result);
    });
  }

  function handleShip() {
    startTransition(async () => {
      const result = await shipOrderAction(orderId);
      reportResult(result);
      setShipDialogOpen(false);
    });
  }

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {showStartProcessing ? (
          <button
            type="button"
            onClick={handleStartProcessing}
            disabled={isPending}
            className="rounded-full bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
          >
            {isPending ? dictionary.starting : dictionary.startProcessing}
          </button>
        ) : null}

        {showMarkReady ? (
          <button
            type="button"
            onClick={handleMarkReady}
            disabled={isPending}
            className="rounded-full bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
          >
            {isPending ? dictionary.markingReady : dictionary.markReady}
          </button>
        ) : null}

        {showShip ? (
          <button
            type="button"
            onClick={() => setShipDialogOpen(true)}
            disabled={isPending}
            className="rounded-full bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
          >
            {isPending ? dictionary.shipping : dictionary.shipOrder}
          </button>
        ) : null}
      </div>

      {shipDialogOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isPending) {
              setShipDialogOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-shipment-title"
            aria-describedby="confirm-shipment-description"
            className="w-full max-w-[420px] rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_24px_70px_-20px_rgba(15,23,42,0.35)] sm:p-6"
          >
            <div>
              <h2
                id="confirm-shipment-title"
                className="text-[18px] font-semibold tracking-tight text-slate-900"
              >
                {dictionary.confirmShipmentTitle}
              </h2>

              <p
                id="confirm-shipment-description"
                className="mt-2 text-[13px] leading-5 text-slate-500"
              >
                {dictionary.confirmShipmentDescription}
              </p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                ref={cancelShipButtonRef}
                type="button"
                onClick={() => setShipDialogOpen(false)}
                disabled={isPending}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50"
              >
                {dictionary.cancel}
              </button>

              <button
                type="button"
                onClick={handleShip}
                disabled={isPending}
                className="h-10 rounded-xl bg-slate-900 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
              >
                {isPending ? dictionary.shipping : dictionary.confirmShipmentButton}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
