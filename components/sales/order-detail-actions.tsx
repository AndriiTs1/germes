"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { cancelSalesOrderAction, confirmSalesOrderAction } from "@/app/sales/orders/[id]/actions";

type OrderDetailActionsProps = {
  orderId: string;
  status: string;
  /** Whether the current user holds sales.orders.update — computed by the page from its own permissionCodes, same convention as every other permission-gated button in SALES. */
  canUpdate: boolean;
};

const CANCEL_CONFIRM_MESSAGE = "Cancel this order? This cannot be undone.";

/**
 * Renders only the lifecycle actions that are actually possible for the
 * order's current status — never a disabled button for an unsupported
 * transition. Matches transitionSalesOrderStatus's exact V1 matrix:
 * DRAFT -> Edit/Confirm/Cancel, CONFIRMED -> Cancel only, every other
 * status (PROCESSING/READY/SHIPPED/COMPLETED/CANCELLED) -> nothing.
 *
 * Cancel is destructive/terminal in this V1 lifecycle (no undo), so it
 * requires an explicit confirmation step first. No dialog/AlertDialog
 * primitive exists anywhere in this codebase yet, and building one for a
 * single button would be exactly the "large dialog dependency/system"
 * this stage was told to avoid — window.confirm is the smallest correct
 * choice given what already exists.
 *
 * Both actions share one pending flag: while either is in flight, both
 * buttons disable, preventing a double-click from firing a second
 * transition client-side (transitionSalesOrderStatus's own atomic
 * updateMany is the real server-side guarantee regardless).
 */
export function OrderDetailActions({ orderId, status, canUpdate }: OrderDetailActionsProps) {
  const [isPending, startTransition] = useTransition();

  if (!canUpdate) return null;

  const showEdit = status === "DRAFT";
  const showConfirm = status === "DRAFT";
  const showCancel = status === "DRAFT" || status === "CONFIRMED";

  if (!showEdit && !showConfirm && !showCancel) return null;

  function handleConfirm() {
    startTransition(async () => {
      const result = await confirmSalesOrderAction(orderId);
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  function handleCancel() {
    if (!window.confirm(CANCEL_CONFIRM_MESSAGE)) return;
    startTransition(async () => {
      const result = await cancelSalesOrderAction(orderId);
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  return (
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
          onClick={handleCancel}
          disabled={isPending}
          className="rounded-full border border-rose-200 bg-white px-4 py-2 text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:pointer-events-none disabled:opacity-50"
        >
          Cancel
        </button>
      ) : null}
    </div>
  );
}
