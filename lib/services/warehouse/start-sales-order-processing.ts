import {
  BatchStatus,
  Prisma,
  ReservationStatus,
  SalesOrderStatus,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const MAX_TRANSACTION_ATTEMPTS = 3;

export type StartSalesOrderProcessingError =
  | "ORDER_UNAVAILABLE"
  | "FULFILLMENT_NOT_READY"
  | "PROCESSING_FAILED";

export type StartSalesOrderProcessingResult =
  | { ok: true }
  | { ok: false; error: StartSalesOrderProcessingError };

/** Thrown inside the transaction to trigger an automatic rollback; caught outside and translated to a safe, generic result — same pattern as createStockReservation/transitionSalesOrderStatus. */
class OrderUnavailableError extends Error {}
class FulfillmentNotReadyError extends Error {}

function isTransactionConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

type ValidatedReservation = {
  id: string;
  salesOrderItemId: string;
  productId: string;
  batchId: string;
  warehouseId: string;
  quantityKg: Prisma.Decimal;
};

/**
 * WAREHOUSE lifecycle operation: CONFIRMED -> PROCESSING.
 *
 * No auth/role/permission logic here — same convention as every other
 * SALES/WAREHOUSE service. The caller must independently
 * requirePermission("inventory.shipments.process") before calling this.
 * currentUserId is used only as AuditLog.actorId for the START_PROCESSING
 * entry — it is NEVER used to scope the SalesOrder query, because accepting
 * an order for warehouse processing is not a SALES-ownership operation; any
 * warehouse operator with the right permission may start processing any
 * CONFIRMED order.
 *
 * Before the order is accepted for processing, every SalesOrderItem must be
 * exactly (not partially, not over-) covered by ACTIVE StockReservations,
 * and every one of those reservations must still be backed by real,
 * available physical stock. Concretely, in order:
 *
 *  1. The order must exist and currently be exactly CONFIRMED.
 *  2. The order must have at least one SalesOrderItem.
 *  3. Elapsed ACTIVE reservations for this order (expiresAt <= now) are
 *     transitioned to EXPIRED first, inside this same SERIALIZABLE
 *     transaction, so the invariants below are evaluated only against
 *     reservations that are genuinely still ACTIVE.
 *  4. Every remaining ACTIVE reservation for this order is validated for
 *     structural integrity (non-null salesOrderItemId/batchId/warehouseId,
 *     quantityKg > 0, references an item that actually belongs to this
 *     order, and its productId matches that item's productId). Any
 *     malformed/legacy reservation fails the whole operation closed —
 *     nothing is ever guessed.
 *  5. For every item independently, SUM(ACTIVE reservation.quantityKg) must
 *     equal item.quantityKg exactly (Prisma.Decimal comparison) — not less,
 *     not more.
 *  6. For every distinct batch+warehouse referenced by an ACTIVE
 *     reservation, the batch must still exist/belong to that reservation's
 *     productId/be AVAILABLE, the warehouse must still exist/be active, and
 *     physical on-hand stock (derived purely from StockMovement — ACTIVE
 *     reservations are never subtracted from it here) must be >= the sum of
 *     ACTIVE reservation quantities for that exact batch+warehouse pair.
 *
 * Only once every invariant above passes does the order transition
 * CONFIRMED -> PROCESSING, via one atomic updateMany re-asserting
 * id + status:CONFIRMED. This function never touches StockMovement, batch
 * status, warehouse stock, shippedAt, or any reservation status besides the
 * elapsed ACTIVE -> EXPIRED transition above — PROCESSING means Warehouse
 * has accepted a fully, safely reserved order for picking; it is not a
 * physical shipment.
 *
 * The transaction runs at SERIALIZABLE isolation and retries P2034
 * conflicts (same MAX_TRANSACTION_ATTEMPTS=3 pattern as
 * createStockReservation/transitionSalesOrderStatus), so a concurrent
 * reservation/expiration/movement change can never be evaluated against a
 * torn snapshot.
 */
export async function startSalesOrderProcessing(
  currentUserId: string,
  salesOrderId: string,
): Promise<StartSalesOrderProcessingResult> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const order = await tx.salesOrder.findFirst({
            where: {
              id: salesOrderId,
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

          const items = await tx.salesOrderItem.findMany({
            where: { salesOrderId: order.id },
            select: { id: true, productId: true, quantityKg: true },
          });

          if (items.length === 0) {
            throw new FulfillmentNotReadyError();
          }

          const itemById = new Map(items.map((item) => [item.id, item]));

          // Expire elapsed ACTIVE reservations for this order first, inside
          // this same SERIALIZABLE transaction, using one shared `now` for
          // both the guard and the audit metadata below.
          const now = new Date();

          const expiring = await tx.stockReservation.findMany({
            where: {
              salesOrderId: order.id,
              status: ReservationStatus.ACTIVE,
              expiresAt: { not: null, lte: now },
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

          for (const reservation of expiring) {
            const expireResult = await tx.stockReservation.updateMany({
              where: {
                id: reservation.id,
                status: ReservationStatus.ACTIVE,
                expiresAt: { not: null, lte: now },
              },
              data: { status: ReservationStatus.EXPIRED },
            });

            if (expireResult.count !== 1) {
              continue;
            }

            await tx.auditLog.create({
              data: {
                actorId: null,
                entityType: "StockReservation",
                entityId: reservation.id,
                action: "EXPIRE",
                metadata: {
                  salesOrderId: order.id,
                  salesOrderItemId: reservation.salesOrderItemId,
                  productId: reservation.productId,
                  batchId: reservation.batchId,
                  warehouseId: reservation.warehouseId,
                  quantityKg: reservation.quantityKg.toString(),
                  expiresAt: reservation.expiresAt?.toISOString() ?? null,
                  expiredAt: now.toISOString(),
                  fromStatus: ReservationStatus.ACTIVE,
                  toStatus: ReservationStatus.EXPIRED,
                },
              },
            });
          }

          // Reload ACTIVE reservations only after expiration has settled —
          // every invariant below is evaluated against this post-expiration
          // set, never the pre-expiration one.
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
            },
          });

          // Structural validation: any malformed/legacy ACTIVE reservation
          // fails the whole operation closed. Nothing here is guessed.
          const validatedReservations: ValidatedReservation[] = [];

          for (const reservation of activeReservations) {
            const { id, salesOrderItemId, batchId, warehouseId, productId, quantityKg } =
              reservation;

            if (!salesOrderItemId || !batchId || !warehouseId || !quantityKg.gt(0)) {
              throw new FulfillmentNotReadyError();
            }

            const item = itemById.get(salesOrderItemId);

            if (!item || item.productId !== productId) {
              throw new FulfillmentNotReadyError();
            }

            validatedReservations.push({
              id,
              salesOrderItemId,
              productId,
              batchId,
              warehouseId,
              quantityKg,
            });
          }

          // Full reservation invariant: every item must be reserved for
          // exactly its ordered quantity — not less, not more.
          const reservedByItemId = new Map<string, Prisma.Decimal>();

          for (const reservation of validatedReservations) {
            const current =
              reservedByItemId.get(reservation.salesOrderItemId) ?? new Prisma.Decimal(0);
            reservedByItemId.set(
              reservation.salesOrderItemId,
              current.plus(reservation.quantityKg),
            );
          }

          for (const item of items) {
            const reservedKg = reservedByItemId.get(item.id) ?? new Prisma.Decimal(0);

            if (!reservedKg.equals(item.quantityKg)) {
              throw new FulfillmentNotReadyError();
            }
          }

          // Fulfillment stock safety, per exact batch+warehouse pair.
          const batchIds = Array.from(
            new Set(validatedReservations.map((reservation) => reservation.batchId)),
          );
          const warehouseIds = Array.from(
            new Set(validatedReservations.map((reservation) => reservation.warehouseId)),
          );

          const [batches, warehouses] = await Promise.all([
            tx.batch.findMany({
              where: { id: { in: batchIds } },
              select: { id: true, productId: true, status: true },
            }),
            tx.warehouse.findMany({
              where: { id: { in: warehouseIds } },
              select: { id: true, isActive: true },
            }),
          ]);

          const batchById = new Map(batches.map((batch) => [batch.id, batch]));
          const warehouseById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));

          for (const reservation of validatedReservations) {
            const batch = batchById.get(reservation.batchId);
            const warehouse = warehouseById.get(reservation.warehouseId);

            if (
              !batch ||
              batch.productId !== reservation.productId ||
              batch.status !== BatchStatus.AVAILABLE
            ) {
              throw new FulfillmentNotReadyError();
            }

            if (!warehouse || !warehouse.isActive) {
              throw new FulfillmentNotReadyError();
            }
          }

          // Multiple reservations may reference the same exact
          // batch+warehouse — aggregate their ACTIVE quantities so
          // over-allocation across reservations can't be missed by
          // checking each reservation independently.
          const aggregateByKey = new Map<
            string,
            { batchId: string; warehouseId: string; quantityKg: Prisma.Decimal }
          >();

          for (const reservation of validatedReservations) {
            const key = `${reservation.batchId}::${reservation.warehouseId}`;
            const existing = aggregateByKey.get(key);

            if (existing) {
              existing.quantityKg = existing.quantityKg.plus(reservation.quantityKg);
            } else {
              aggregateByKey.set(key, {
                batchId: reservation.batchId,
                warehouseId: reservation.warehouseId,
                quantityKg: reservation.quantityKg,
              });
            }
          }

          for (const { batchId, warehouseId, quantityKg } of aggregateByKey.values()) {
            const movements = await tx.stockMovement.findMany({
              where: {
                batchId,
                OR: [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }],
              },
              select: { fromWarehouseId: true, toWarehouseId: true, quantityKg: true },
            });

            let onHandKg = new Prisma.Decimal(0);

            for (const movement of movements) {
              if (movement.toWarehouseId === warehouseId) {
                onHandKg = onHandKg.plus(movement.quantityKg);
              }

              if (movement.fromWarehouseId === warehouseId) {
                onHandKg = onHandKg.minus(movement.quantityKg);
              }
            }

            if (onHandKg.lt(quantityKg)) {
              throw new FulfillmentNotReadyError();
            }
          }

          // THE actual atomic guard: id + status are re-asserted together
          // in one UPDATE statement. If the order's status changed since
          // the read at the top of this transaction (a genuine race), count
          // will be 0 here even though that earlier read passed.
          const updateResult = await tx.salesOrder.updateMany({
            where: {
              id: order.id,
              status: SalesOrderStatus.CONFIRMED,
            },
            data: { status: SalesOrderStatus.PROCESSING },
          });

          if (updateResult.count !== 1) {
            throw new OrderUnavailableError();
          }

          await tx.auditLog.create({
            data: {
              actorId: currentUserId,
              entityType: "SalesOrder",
              entityId: order.id,
              action: "START_PROCESSING",
              metadata: {
                orderNumber: order.orderNumber,
                fromStatus: SalesOrderStatus.CONFIRMED,
                toStatus: SalesOrderStatus.PROCESSING,
                itemCount: items.length,
                reservationCount: validatedReservations.length,
              },
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      return { ok: true };
    } catch (error) {
      if (error instanceof OrderUnavailableError) {
        return { ok: false, error: "ORDER_UNAVAILABLE" };
      }

      if (error instanceof FulfillmentNotReadyError) {
        return { ok: false, error: "FULFILLMENT_NOT_READY" };
      }

      if (isTransactionConflict(error) && attempt < MAX_TRANSACTION_ATTEMPTS) {
        continue;
      }

      return { ok: false, error: "PROCESSING_FAILED" };
    }
  }

  return { ok: false, error: "PROCESSING_FAILED" };
}
