"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  cancelSalesOrderAction,
  confirmSalesOrderAction,
} from "@/app/sales/orders/[id]/actions";

type OrderDetailActionsProps = {
  orderId: string;
  status: string;
  canUpdate: boolean;
};

export function OrderDetailActions({
  orderId,
  status,
  canUpdate,
}: OrderDetailActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const keepOrderButtonRef = useRef<HTMLButtonElement>(null);

  const showEdit = status === "DRAFT";
  const showConfirm = status === "DRAFT";
  const showCancel = status === "DRAFT" || status === "CONFIRMED";

  useEffect(() => {
    if (!cancelDialogOpen) return;

    keepOrderButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) {
        setCancelDialogOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [cancelDialogOpen, isPending]);

  useEffect(() => {
    if (!cancelDialogOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [cancelDialogOpen]);

  if (!canUpdate) return null;
  if (!showEdit && !showConfirm && !showCancel) return null;

  function handleConfirm() {
    startTransition(async () => {
      const result = await confirmSalesOrderAction(orderId);

      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  function handleCancelOrder() {
    startTransition(async () => {
      const result = await cancelSalesOrderAction(orderId);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      setCancelDialogOpen(false);
    });
  }

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {showEdit ? (
          <Link
            href={`/sales/orders/${orderId}/edit`}
            className="rounded-full border border-slate-200/70 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Edit
          </Link>
        ) : null}

        {showConfirm ? (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-full bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
          >
            {isPending ? "Confirming…" : "Confirm"}
          </button>
        ) : null}

        {showCancel ? (
          <button
            type="button"
            onClick={() => setCancelDialogOpen(true)}
            disabled={isPending}
            className="rounded-full border border-rose-200 bg-white px-4 py-2 text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:pointer-events-none disabled:opacity-50"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {cancelDialogOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isPending) {
              setCancelDialogOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-order-title"
            aria-describedby="cancel-order-description"
            className="w-full max-w-[420px] rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_24px_70px_-20px_rgba(15,23,42,0.35)] sm:p-6"
          >
            <div>
              <h2
                id="cancel-order-title"
                className="text-[18px] font-semibold tracking-tight text-slate-900"
              >
                Cancel order?
              </h2>

              <p
                id="cancel-order-description"
                className="mt-2 text-[13px] leading-5 text-slate-500"
              >
                This will cancel the order and release all active stock
                reservations. This action cannot be undone.
              </p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                ref={keepOrderButtonRef}
                type="button"
                onClick={() => setCancelDialogOpen(false)}
                disabled={isPending}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50"
              >
                Keep order
              </button>

              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={isPending}
                className="h-10 rounded-xl bg-rose-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-rose-700 disabled:pointer-events-none disabled:opacity-50"
              >
                {isPending ? "Cancelling…" : "Cancel order"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
