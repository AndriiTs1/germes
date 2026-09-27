import { Prisma, PurchaseOrderStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  assertPurchaseOrderReferences,
  CONFIRM_ELIGIBLE_SUPPLIER_STATUSES,
  PurchaseOrderRuleError,
} from "@/lib/services/procurement/purchase-order-rules";

export type PurchaseOrderTransition = "CONFIRM" | "CANCEL";

export type TransitionPurchaseOrderError =
  | "INVALID_TRANSITION"
  | "STATUS_CHANGED"
  /** CONFIRM only: the supplier is not active (isActive + status ACTIVE). */
  | "SUPPLIER_NOT_ACTIVE"
  | "WAREHOUSE_UNAVAILABLE"
  | "PRODUCT_UNAVAILABLE"
  | "TRANSITION_FAILED";

export type TransitionPurchaseOrderResult =
  | { ok: true; fromStatus: PurchaseOrderStatus; toStatus: PurchaseOrderStatus }
  | { ok: false; error: TransitionPurchaseOrderError };

const MAX_TRANSACTION_ATTEMPTS = 3;

/**
 * The only source of truth for what's allowed in this stage. CLOSED is
 * deliberately unreachable (it belongs to future receiving), and
 * CANCELLED/CLOSED are terminal. CONFIRMED can still be cancelled because
 * no receipt data exists yet to forbid it.
 */
const ALLOWED_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: [PurchaseOrderStatus.CONFIRMED, PurchaseOrderStatus.CANCELLED],
  CONFIRMED: [PurchaseOrderStatus.CANCELLED],
  CLOSED: [],
  CANCELLED: [],
};

const TRANSITION_TARGET: Record<PurchaseOrderTransition, PurchaseOrderStatus> = {
  CONFIRM: PurchaseOrderStatus.CONFIRMED,
  CANCEL: PurchaseOrderStatus.CANCELLED,
};

class InvalidTransitionError extends Error {}
class StatusChangedError extends Error {}

function isTransactionConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

/**
 * Applies one allowed lifecycle transition to a PurchaseOrder.
 *
 * CONFIRM (DRAFT → CONFIRMED): the order becomes an agreed, binding
 * purchase commitment. Its supplier must be active and in status ACTIVE
 * (stricter than the DRAFT rule, which also allows POTENTIAL/IN_PROGRESS);
 * destination warehouse (if set) and products are re-checked with the same
 * rules as creating/editing a DRAFT. All checks run before any write, and
 * orderDate is set to now — once, since only a DRAFT can be
 * confirmed. Item prices and the planned arrival date stay optional, as
 * elsewhere; nothing new is required here.
 *
 * CANCEL (DRAFT/CONFIRMED → CANCELLED): terminal.
 *
 * The status change is one updateMany guarded by the status that was just
 * read, inside a SERIALIZABLE transaction retried on P2034 (same pattern
 * as transitionSalesOrderStatus) — so a concurrent transition or edit can
 * never be silently overwritten; it yields STATUS_CHANGED instead.
 *
 * No authorization here: the caller must requirePermission
 * ("procurement.orders.update").
 */
export async function transitionPurchaseOrderStatus(
  currentUserId: string,
  purchaseOrderId: string,
  transition: PurchaseOrderTransition,
): Promise<TransitionPurchaseOrderResult> {
  const toStatus = TRANSITION_TARGET[transition];

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt++) {
    try {
      const fromStatus = await prisma.$transaction(
        async (tx) => {
          const order = await tx.purchaseOrder.findUnique({
            where: { id: purchaseOrderId },
            select: {
              id: true,
              orderNumber: true,
              status: true,
              supplierId: true,
              destinationWarehouseId: true,
              items: { select: { productId: true } },
            },
          });

          if (!order || !ALLOWED_TRANSITIONS[order.status].includes(toStatus)) {
            throw new InvalidTransitionError();
          }

          if (transition === "CONFIRM") {
            await assertPurchaseOrderReferences(
              tx,
              {
                supplierId: order.supplierId,
                destinationWarehouseId: order.destinationWarehouseId,
                productIds: order.items.map((item) => item.productId),
              },
              CONFIRM_ELIGIBLE_SUPPLIER_STATUSES,
            );
          }

          const updated = await tx.purchaseOrder.updateMany({
            where: { id: order.id, status: order.status },
            data: transition === "CONFIRM" ? { status: toStatus, orderDate: new Date() } : { status: toStatus },
          });

          if (updated.count !== 1) {
            throw new StatusChangedError();
          }

          await tx.auditLog.create({
            data: {
              actorId: currentUserId,
              entityType: "PurchaseOrder",
              entityId: order.id,
              action: transition,
              metadata: { orderNumber: order.orderNumber, fromStatus: order.status, toStatus },
            },
          });

          return order.status;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return { ok: true, fromStatus, toStatus };
    } catch (error) {
      if (error instanceof InvalidTransitionError) return { ok: false, error: "INVALID_TRANSITION" };
      if (error instanceof StatusChangedError) return { ok: false, error: "STATUS_CHANGED" };
      if (error instanceof PurchaseOrderRuleError) {
        if (error.code === "SUPPLIER_UNAVAILABLE") return { ok: false, error: "SUPPLIER_NOT_ACTIVE" };
        return { ok: false, error: error.code === "INVALID_ITEM" ? "TRANSITION_FAILED" : error.code };
      }
      if (isTransactionConflict(error) && attempt < MAX_TRANSACTION_ATTEMPTS) continue;
      return { ok: false, error: "TRANSITION_FAILED" };
    }
  }

  return { ok: false, error: "TRANSITION_FAILED" };
}
