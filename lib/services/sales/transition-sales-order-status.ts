import { SalesOrderStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type SalesOrderTransition = "CONFIRM" | "CANCEL";

export type TransitionSalesOrderError = "INVALID_TRANSITION" | "TRANSITION_FAILED";

export type TransitionSalesOrderResult =
  | { ok: true; fromStatus: SalesOrderStatus; toStatus: SalesOrderStatus; customerId: string }
  | { ok: false; error: TransitionSalesOrderError };

/** Thrown inside the transaction to trigger an automatic rollback; caught outside and translated to a safe, generic result. */
class InvalidTransitionError extends Error {}

/**
 * Explicit allow-list — the only source of truth for what's allowed.
 * Anything not listed (including every warehouse/fulfillment status and
 * every terminal status) resolves to an empty array, i.e. rejected.
 * PROCESSING/READY/SHIPPED/COMPLETED/CANCELLED all deliberately have zero
 * allowed targets in this V1 stage — no manual SALES completion, no
 * warehouse-status shortcuts.
 */
const ALLOWED_TRANSITIONS: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  DRAFT: [SalesOrderStatus.CONFIRMED, SalesOrderStatus.CANCELLED],
  CONFIRMED: [SalesOrderStatus.CANCELLED],
  PROCESSING: [],
  READY: [],
  SHIPPED: [],
  COMPLETED: [],
  CANCELLED: [],
};

const TRANSITION_TARGET: Record<SalesOrderTransition, SalesOrderStatus> = {
  CONFIRM: SalesOrderStatus.CONFIRMED,
  CANCEL: SalesOrderStatus.CANCELLED,
};

const TRANSITION_ACTION: Record<SalesOrderTransition, string> = {
  CONFIRM: "CONFIRM",
  CANCEL: "CANCEL",
};

/**
 * Applies exactly one of the two allowed V1 lifecycle transitions
 * (CONFIRM or CANCEL) to a SalesOrder owned by currentUserId, atomically.
 *
 * No auth/permission/role logic here — same convention as every other
 * SALES service; the caller is responsible for
 * requirePermission("sales.orders.update"). No role.code, no OWNER bypass:
 * scope is strictly id + responsibleId.
 *
 * The decision of whether a transition is valid always uses the status
 * just read from the database inside this transaction — `transition`
 * only names which action the caller wants (CONFIRM/CANCEL); the actual
 * target and source statuses are never taken from client input.
 *
 * Race safety: the write is one atomic `updateMany` whose WHERE
 * re-asserts id + responsibleId + status:<the status just read>. If a
 * concurrent request (a double-click, two open tabs, a stale page) already
 * changed the status by the time this write runs, the WHERE no longer
 * matches, `count` is 0, and this throws — a second transition can never
 * land on top of one that already succeeded. The AuditLog entry is
 * written in the same transaction as the status write, so a transition is
 * never recorded unless it actually happened, and never happens without
 * being recorded.
 *
 * No side effects beyond the status change + audit row: no
 * StockReservation, no Receivable, no inventory change, no notification —
 * all explicitly out of scope for this stage.
 *
 * On success, also returns the order's own customerId (already present on
 * the row just read — no extra query) so the caller can revalidate the
 * affected customer's pages: a CANCEL changes Customer.activeOrdersCount
 * (see lib/services/sales/list-sales-customers.ts), and both CONFIRM and
 * CANCEL change the status badge shown in that customer's recent-orders
 * list on /sales/customers/[id].
 */
export async function transitionSalesOrderStatus(
  currentUserId: string,
  orderId: string,
  transition: SalesOrderTransition,
): Promise<TransitionSalesOrderResult> {
  const toStatus = TRANSITION_TARGET[transition];

  try {
    const transactionResult = await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findFirst({
        where: { id: orderId, responsibleId: currentUserId },
        select: { id: true, status: true, orderNumber: true, customerId: true },
      });

      if (!order) {
        throw new InvalidTransitionError();
      }

      const allowedTargets = ALLOWED_TRANSITIONS[order.status];
      if (!allowedTargets.includes(toStatus)) {
        throw new InvalidTransitionError();
      }

      const updateResult = await tx.salesOrder.updateMany({
        where: { id: orderId, responsibleId: currentUserId, status: order.status },
        data: { status: toStatus },
      });

      if (updateResult.count !== 1) {
        // Status changed between the read above and this write — a
        // genuine concurrent transition already happened. Never a second
        // write, never a second audit row.
        throw new InvalidTransitionError();
      }

      await tx.auditLog.create({
        data: {
          actorId: currentUserId,
          entityType: "SalesOrder",
          entityId: order.id,
          action: TRANSITION_ACTION[transition],
          metadata: {
            orderNumber: order.orderNumber,
            fromStatus: order.status,
            toStatus,
          },
        },
      });

      return { fromStatus: order.status, customerId: order.customerId };
    });

    return {
      ok: true,
      fromStatus: transactionResult.fromStatus,
      toStatus,
      customerId: transactionResult.customerId,
    };
  } catch (error) {
    if (error instanceof InvalidTransitionError) {
      return { ok: false, error: "INVALID_TRANSITION" };
    }
    return { ok: false, error: "TRANSITION_FAILED" };
  }
}
