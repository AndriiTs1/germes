import {
  Prisma,
  ReservationStatus,
  SalesOrderStatus,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type SalesOrderTransition = "CONFIRM" | "CANCEL";

export type TransitionSalesOrderError =
  | "INVALID_TRANSITION"
  | "TRANSITION_FAILED";

export type TransitionSalesOrderResult =
  | {
      ok: true;
      fromStatus: SalesOrderStatus;
      toStatus: SalesOrderStatus;
      customerId: string;
    }
  | { ok: false; error: TransitionSalesOrderError };

const MAX_TRANSACTION_ATTEMPTS = 3;

class InvalidTransitionError extends Error {}

function isTransactionConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

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
 * Applies exactly one allowed V1 lifecycle transition to a SalesOrder
 * owned by currentUserId.
 *
 * CANCEL has one additional invariant: every ACTIVE reservation linked to
 * the order is released atomically with the order cancellation. Physical
 * StockMovement is never modified by reservation release.
 *
 * The transaction uses SERIALIZABLE isolation and retries P2034 conflicts.
 * This protects the cancellation boundary against a concurrent reservation
 * creation that may have read the order while it was still CONFIRMED.
 *
 * No auth/permission/role logic lives here. The caller must independently
 * requirePermission("sales.orders.update").
 */
export async function transitionSalesOrderStatus(
  currentUserId: string,
  orderId: string,
  transition: SalesOrderTransition,
): Promise<TransitionSalesOrderResult> {
  const toStatus = TRANSITION_TARGET[transition];

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt++) {
    try {
      const transactionResult = await prisma.$transaction(
        async (tx) => {
          const order = await tx.salesOrder.findFirst({
            where: {
              id: orderId,
              responsibleId: currentUserId,
            },
            select: {
              id: true,
              status: true,
              orderNumber: true,
              customerId: true,
            },
          });

          if (!order) {
            throw new InvalidTransitionError();
          }

          const allowedTargets = ALLOWED_TRANSITIONS[order.status];

          if (!allowedTargets.includes(toStatus)) {
            throw new InvalidTransitionError();
          }

          const updateResult = await tx.salesOrder.updateMany({
            where: {
              id: order.id,
              responsibleId: currentUserId,
              status: order.status,
            },
            data: {
              status: toStatus,
            },
          });

          if (updateResult.count !== 1) {
            throw new InvalidTransitionError();
          }

          if (transition === "CANCEL") {
            const activeReservations = await tx.stockReservation.findMany({
              where: {
                salesOrderId: order.id,
                status: ReservationStatus.ACTIVE,
              },
              select: {
                id: true,
                salesOrderItemId: true,
                productId: true,
                batchId: true,
                warehouseId: true,
                quantityKg: true,
                expiresAt: true,
              },
            });

            for (const reservation of activeReservations) {
              const releaseResult = await tx.stockReservation.updateMany({
                where: {
                  id: reservation.id,
                  salesOrderId: order.id,
                  status: ReservationStatus.ACTIVE,
                },
                data: {
                  status: ReservationStatus.RELEASED,
                },
              });

              if (releaseResult.count !== 1) {
                continue;
              }

              await tx.auditLog.create({
                data: {
                  actorId: currentUserId,
                  entityType: "StockReservation",
                  entityId: reservation.id,
                  action: "RELEASE",
                  metadata: {
                    reason: "ORDER_CANCELLED",
                    salesOrderId: order.id,
                    salesOrderItemId: reservation.salesOrderItemId,
                    productId: reservation.productId,
                    batchId: reservation.batchId,
                    warehouseId: reservation.warehouseId,
                    quantityKg: reservation.quantityKg.toString(),
                    expiresAt: reservation.expiresAt?.toISOString() ?? null,
                    fromStatus: ReservationStatus.ACTIVE,
                    toStatus: ReservationStatus.RELEASED,
                  },
                },
              });
            }
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

          return {
            fromStatus: order.status,
            customerId: order.customerId,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

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

      if (
        isTransactionConflict(error) &&
        attempt < MAX_TRANSACTION_ATTEMPTS
      ) {
        continue;
      }

      return { ok: false, error: "TRANSITION_FAILED" };
    }
  }

  return { ok: false, error: "TRANSITION_FAILED" };
}
