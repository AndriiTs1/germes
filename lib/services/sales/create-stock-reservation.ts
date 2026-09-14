import {
  BatchStatus,
  Prisma,
  ReservationStatus,
  SalesOrderStatus,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const RESERVATION_TTL_HOURS = 24;
const MAX_TRANSACTION_ATTEMPTS = 3;

export type CreateStockReservationInput = {
  salesOrderId: string;
  salesOrderItemId: string;
  batchId: string;
  warehouseId: string;
  /** Already Zod-validated Decimal(14,3) string, strictly > 0. */
  quantityKg: string;
};

export type CreateStockReservationError =
  | "ORDER_UNAVAILABLE"
  | "ITEM_UNAVAILABLE"
  | "STOCK_UNAVAILABLE"
  | "CREATE_FAILED";

export type CreateStockReservationResult =
  | { ok: true; reservationId: string }
  | { ok: false; error: CreateStockReservationError };

class OrderUnavailableError extends Error {}
class ItemUnavailableError extends Error {}
class StockUnavailableError extends Error {}

function isTransactionConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

/**
 * Creates one ACTIVE stock reservation for a concrete:
 *
 * SalesOrder -> SalesOrderItem -> Product -> Batch -> Warehouse
 *
 * V1 rules:
 * - only the responsible SALES user's own order;
 * - order must be CONFIRMED;
 * - batch must belong to the SalesOrderItem product and be AVAILABLE;
 * - warehouse must be active;
 * - total ACTIVE reservations for the item may not exceed ordered quantity;
 * - exact batch+warehouse physical stock is derived from StockMovement;
 * - ACTIVE reservations for that exact batch+warehouse reduce availability;
 * - legacy ACTIVE reservations for the batch without warehouseId block creation
 *   because their physical location cannot be safely inferred;
 * - relevant elapsed ACTIVE reservations are transitioned to EXPIRED inside
 *   the same SERIALIZABLE transaction before availability is calculated;
 * - reservation expiresAt is server-controlled: now + 24 hours.
 *
 * The transaction runs at SERIALIZABLE isolation and retries P2034 conflicts,
 * preventing concurrent successful reservations from overselling the same
 * stock snapshot.
 */
export async function createStockReservation(
  currentUserId: string,
  input: CreateStockReservationInput,
): Promise<CreateStockReservationResult> {
  let quantityKg: Prisma.Decimal;

  try {
    quantityKg = new Prisma.Decimal(input.quantityKg);
  } catch {
    return { ok: false, error: "CREATE_FAILED" };
  }

  if (!quantityKg.gt(0)) {
    return { ok: false, error: "CREATE_FAILED" };
  }

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt++) {
    try {
      const reservationId = await prisma.$transaction(
        async (tx) => {
          const order = await tx.salesOrder.findFirst({
            where: {
              id: input.salesOrderId,
              responsibleId: currentUserId,
              status: SalesOrderStatus.CONFIRMED,
            },
            select: {
              id: true,
              orderNumber: true,
            },
          });

          if (!order) {
            throw new OrderUnavailableError();
          }

          const item = await tx.salesOrderItem.findFirst({
            where: {
              id: input.salesOrderItemId,
              salesOrderId: order.id,
            },
            select: {
              id: true,
              productId: true,
              quantityKg: true,
            },
          });

          if (!item) {
            throw new ItemUnavailableError();
          }

          const [batch, warehouse] = await Promise.all([
            tx.batch.findFirst({
              where: {
                id: input.batchId,
                productId: item.productId,
                status: BatchStatus.AVAILABLE,
              },
              select: {
                id: true,
                batchNumber: true,
              },
            }),
            tx.warehouse.findFirst({
              where: {
                id: input.warehouseId,
                isActive: true,
              },
              select: {
                id: true,
                code: true,
              },
            }),
          ]);

          if (!batch || !warehouse) {
            throw new StockUnavailableError();
          }

          // Expire elapsed reservations inside this same SERIALIZABLE
          // transaction before any ACTIVE-reservation availability calculation.
          // This keeps expiration and the stock snapshot concurrency-safe.
          const expirationNow = new Date();

          const expiredReservations = await tx.stockReservation.findMany({
            where: {
              status: ReservationStatus.ACTIVE,
              expiresAt: {
                not: null,
                lte: expirationNow,
              },
              OR: [
                {
                  salesOrderItemId: item.id,
                },
                {
                  batchId: batch.id,
                  warehouseId: warehouse.id,
                },
                {
                  batchId: batch.id,
                  warehouseId: null,
                },
              ],
            },
            select: {
              id: true,
              salesOrderId: true,
              salesOrderItemId: true,
              productId: true,
              batchId: true,
              warehouseId: true,
              quantityKg: true,
              expiresAt: true,
            },
          });

          for (const expiredReservation of expiredReservations) {
            const expireResult = await tx.stockReservation.updateMany({
              where: {
                id: expiredReservation.id,
                status: ReservationStatus.ACTIVE,
                expiresAt: {
                  not: null,
                  lte: expirationNow,
                },
              },
              data: {
                status: ReservationStatus.EXPIRED,
              },
            });

            if (expireResult.count !== 1) {
              continue;
            }

            await tx.auditLog.create({
              data: {
                actorId: null,
                entityType: "StockReservation",
                entityId: expiredReservation.id,
                action: "EXPIRE",
                metadata: {
                  salesOrderId: expiredReservation.salesOrderId,
                  salesOrderItemId: expiredReservation.salesOrderItemId,
                  productId: expiredReservation.productId,
                  batchId: expiredReservation.batchId,
                  warehouseId: expiredReservation.warehouseId,
                  quantityKg: expiredReservation.quantityKg.toString(),
                  expiresAt:
                    expiredReservation.expiresAt?.toISOString() ?? null,
                  expiredAt: expirationNow.toISOString(),
                  fromStatus: ReservationStatus.ACTIVE,
                  toStatus: ReservationStatus.EXPIRED,
                },
              },
            });
          }

          const itemReservations = await tx.stockReservation.aggregate({
            where: {
              salesOrderItemId: item.id,
              status: ReservationStatus.ACTIVE,
            },
            _sum: {
              quantityKg: true,
            },
          });

          const alreadyReservedForItem =
            itemReservations._sum.quantityKg ?? new Prisma.Decimal(0);

          const remainingItemKg = item.quantityKg.minus(
            alreadyReservedForItem,
          );

          if (quantityKg.gt(remainingItemKg)) {
            throw new StockUnavailableError();
          }

          // A legacy ACTIVE reservation for this batch has no warehouse
          // identity. We cannot safely know which warehouse stock it holds,
          // so fail closed instead of guessing.
          const legacyBatchReservation =
            await tx.stockReservation.findFirst({
              where: {
                batchId: batch.id,
                warehouseId: null,
                status: ReservationStatus.ACTIVE,
              },
              select: {
                id: true,
              },
            });

          if (legacyBatchReservation) {
            throw new StockUnavailableError();
          }

          const movements = await tx.stockMovement.findMany({
            where: {
              batchId: batch.id,
              OR: [
                { fromWarehouseId: warehouse.id },
                { toWarehouseId: warehouse.id },
              ],
            },
            select: {
              fromWarehouseId: true,
              toWarehouseId: true,
              quantityKg: true,
            },
          });

          let onHandKg = new Prisma.Decimal(0);

          for (const movement of movements) {
            if (movement.toWarehouseId === warehouse.id) {
              onHandKg = onHandKg.plus(movement.quantityKg);
            }

            if (movement.fromWarehouseId === warehouse.id) {
              onHandKg = onHandKg.minus(movement.quantityKg);
            }
          }

          const warehouseReservations =
            await tx.stockReservation.aggregate({
              where: {
                batchId: batch.id,
                warehouseId: warehouse.id,
                status: ReservationStatus.ACTIVE,
              },
              _sum: {
                quantityKg: true,
              },
            });

          const alreadyReservedAtWarehouse =
            warehouseReservations._sum.quantityKg ??
            new Prisma.Decimal(0);

          const availableKg = onHandKg.minus(
            alreadyReservedAtWarehouse,
          );

          if (quantityKg.gt(availableKg)) {
            throw new StockUnavailableError();
          }

          const expiresAt = new Date(
            expirationNow.getTime() + RESERVATION_TTL_HOURS * 60 * 60 * 1000,
          );

          const reservation = await tx.stockReservation.create({
            data: {
              productId: item.productId,
              batchId: batch.id,
              warehouseId: warehouse.id,
              salesOrderId: order.id,
              salesOrderItemId: item.id,
              quantityKg,
              status: ReservationStatus.ACTIVE,
              expiresAt,
              reference: order.orderNumber,
            },
            select: {
              id: true,
            },
          });

          await tx.auditLog.create({
            data: {
              actorId: currentUserId,
              entityType: "StockReservation",
              entityId: reservation.id,
              action: "CREATE",
              metadata: {
                salesOrderId: order.id,
                salesOrderItemId: item.id,
                productId: item.productId,
                batchId: batch.id,
                batchNumber: batch.batchNumber,
                warehouseId: warehouse.id,
                warehouseCode: warehouse.code,
                quantityKg: quantityKg.toString(),
                expiresAt: expiresAt.toISOString(),
              },
            },
          });

          return reservation.id;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      return {
        ok: true,
        reservationId,
      };
    } catch (error) {
      if (error instanceof OrderUnavailableError) {
        return { ok: false, error: "ORDER_UNAVAILABLE" };
      }

      if (error instanceof ItemUnavailableError) {
        return { ok: false, error: "ITEM_UNAVAILABLE" };
      }

      if (error instanceof StockUnavailableError) {
        return { ok: false, error: "STOCK_UNAVAILABLE" };
      }

      if (
        isTransactionConflict(error) &&
        attempt < MAX_TRANSACTION_ATTEMPTS
      ) {
        continue;
      }

      return { ok: false, error: "CREATE_FAILED" };
    }
  }

  return { ok: false, error: "CREATE_FAILED" };
}
