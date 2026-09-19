import {
  BatchStatus,
  FinanceStatus,
  Prisma,
  ReservationStatus,
  SalesOrderStatus,
  StockMovementType,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const MAX_TRANSACTION_ATTEMPTS = 3;

export type ShipSalesOrderError =
  | "ORDER_UNAVAILABLE"
  | "FULFILLMENT_NOT_READY"
  | "SHIPMENT_FAILED";

export type ShipSalesOrderResult =
  | { ok: true }
  | { ok: false; error: ShipSalesOrderError };

/** Thrown inside the transaction to trigger an automatic rollback; caught outside and translated to a safe, generic result — same pattern as startSalesOrderProcessing/markSalesOrderReady/createStockReservation/transitionSalesOrderStatus. */
class OrderUnavailableError extends Error {}
class FulfillmentNotReadyError extends Error {}

function isTransactionConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
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
 * WAREHOUSE lifecycle operation: READY -> SHIPPED.
 *
 * This is the critical physical-shipment boundary: it is the only place in
 * the fulfillment workflow that creates a real StockMovement and permanently
 * consumes reservations. Every other warehouse lifecycle service
 * (startSalesOrderProcessing, markSalesOrderReady) is pure validation —
 * this one has an irreversible physical side effect, so every invariant
 * below is re-checked from scratch inside the same transaction that
 * performs it, and everything commits or rolls back together.
 *
 * No auth/role/permission logic here — same convention as every other
 * SALES/WAREHOUSE service. The caller must independently
 * requirePermission("inventory.shipments.process") before calling this.
 * currentUserId is used only as AuditLog.actorId — it is NEVER used to
 * scope the SalesOrder query, because shipping an order is not a
 * SALES-ownership operation; any warehouse operator with the right
 * permission may ship any READY order regardless of who sold it.
 *
 *  1. The order must exist and currently be exactly READY.
 *  2. The order must have at least one SalesOrderItem.
 *  3. Every ACTIVE reservation for this order is validated for structural
 *     integrity (non-null salesOrderItemId/batchId/warehouseId,
 *     quantityKg > 0, references an item that actually belongs to this
 *     order, and its productId matches that item's productId). Any
 *     malformed/legacy reservation fails the whole operation closed —
 *     nothing is ever guessed.
 *  4. Like markSalesOrderReady, this service does NOT perform expiration
 *     housekeeping — it never transitions a reservation ACTIVE -> EXPIRED.
 *     An ACTIVE reservation whose expiresAt <= now simply fails fulfillment
 *     validation closed.
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
 * Only once every invariant above passes does this function have any
 * physical/persistent effect, all inside the one transaction:
 *
 *  a. Exactly one StockMovement (type SHIPMENT, fromWarehouseId set,
 *     toWarehouseId null) is created per distinct batch+warehouse
 *     aggregate — never per individual reservation, so two reservations
 *     sharing the same batch+warehouse produce one movement, not two.
 *  b. Every validated reservation is consumed via a guarded updateMany
 *     re-asserting id + salesOrderId + status:ACTIVE + the same
 *     not-elapsed boundary, requiring count === 1 — if any reservation
 *     cannot be consumed exactly once (e.g. a concurrent change since
 *     validation), the whole transaction rolls back, so a shipment is
 *     never partially consumed.
 *  c. The order transitions READY -> SHIPPED via one atomic updateMany
 *     re-asserting id + status:READY, with shippedAt set to the same
 *     shared `now` — this is the critical double-shipment guard: a second
 *     concurrent shipment attempt can never find the order still READY
 *     once the first has committed.
 *
 * This function never modifies Batch, Warehouse, SalesOrderItem, or
 * Customer and never marks the order COMPLETED. A successful physical
 * shipment also creates the order's OPEN Receivable in the same transaction,
 * so stock, order status, and the financial consequence commit atomically.
 *
 * The transaction runs at SERIALIZABLE isolation and retries P2034
 * conflicts (same MAX_TRANSACTION_ATTEMPTS=3 pattern as the other
 * warehouse/reservation services), so a concurrent reservation/movement/
 * shipment attempt can never be evaluated against a torn snapshot.
 */
export async function shipSalesOrder(
  currentUserId: string,
  salesOrderId: string,
): Promise<ShipSalesOrderResult> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const order = await tx.salesOrder.findFirst({
            where: {
              id: salesOrderId,
              status: SalesOrderStatus.READY,
            },
            select: {
              id: true,
              orderNumber: true,
              customerId: true,
              currency: true,
              customer: {
                select: {
                  paymentTermDays: true,
                },
              },
            },
          });

          if (!order) {
            throw new OrderUnavailableError();
          }

          const items = await tx.salesOrderItem.findMany({
            where: { salesOrderId: order.id },
            select: {
              id: true,
              productId: true,
              quantityKg: true,
              pricePerKg: true,
            },
          });

          if (items.length === 0) {
            throw new FulfillmentNotReadyError();
          }

          const itemById = new Map(items.map((item) => [item.id, item]));

          // One shared timestamp for expiration validation, shippedAt, and
          // every AuditLog entry created below.
          const now = new Date();

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

          // Structural + expiration validation: any malformed/legacy/
          // elapsed ACTIVE reservation fails the whole operation closed.
          // No reservation is mutated here and no expiration housekeeping
          // is performed — an elapsed reservation is just an invariant
          // violation, exactly like markSalesOrderReady.
          const validatedReservations: ValidatedReservation[] = [];

          for (const reservation of activeReservations) {
            const { id, salesOrderItemId, batchId, warehouseId, productId, quantityKg, expiresAt } =
              reservation;

            if (!salesOrderItemId || !batchId || !warehouseId || !quantityKg.gt(0)) {
              throw new FulfillmentNotReadyError();
            }

            if (expiresAt !== null && expiresAt <= now) {
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

          // Full reservation invariant: every item must still be reserved
          // for exactly its ordered quantity — not less, not more.
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

          // Batch/warehouse existence and status validation.
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
          // batch+warehouse — aggregate their ACTIVE quantities first. This
          // aggregate is both the physical-stock-safety check unit AND the
          // exact quantity of the single StockMovement created per pair
          // below (never one movement per reservation).
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

          // Only now, after every invariant has passed, does this function
          // have any physical/persistent effect. Exactly one SHIPMENT
          // StockMovement per distinct batch+warehouse aggregate.
          let shipmentMovementCount = 0;

          for (const { batchId, warehouseId, quantityKg } of aggregateByKey.values()) {
            await tx.stockMovement.create({
              data: {
                type: StockMovementType.SHIPMENT,
                batchId,
                fromWarehouseId: warehouseId,
                toWarehouseId: null,
                quantityKg,
                reference: order.orderNumber,
              },
            });

            shipmentMovementCount += 1;
          }

          // Consume every validated reservation. The guard re-asserts the
          // same not-elapsed boundary evaluated against `now` above — if
          // any reservation can no longer be consumed exactly once, the
          // whole transaction (including the shipment movements just
          // created) rolls back.
          for (const reservation of validatedReservations) {
            const consumeResult = await tx.stockReservation.updateMany({
              where: {
                id: reservation.id,
                salesOrderId: order.id,
                status: ReservationStatus.ACTIVE,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              },
              data: { status: ReservationStatus.CONSUMED },
            });

            if (consumeResult.count !== 1) {
              throw new FulfillmentNotReadyError();
            }

            await tx.auditLog.create({
              data: {
                actorId: currentUserId,
                entityType: "StockReservation",
                entityId: reservation.id,
                action: "CONSUME",
                metadata: {
                  salesOrderId: order.id,
                  salesOrderItemId: reservation.salesOrderItemId,
                  productId: reservation.productId,
                  batchId: reservation.batchId,
                  warehouseId: reservation.warehouseId,
                  quantityKg: reservation.quantityKg.toString(),
                  consumedAt: now.toISOString(),
                  fromStatus: ReservationStatus.ACTIVE,
                  toStatus: ReservationStatus.CONSUMED,
                },
              },
            });
          }

          // THE critical double-shipment guard: id + status are
          // re-asserted together in one UPDATE statement. If the order's
          // status changed since the read at the top of this transaction
          // (including a concurrent shipment that already committed), count
          // will be 0 here even though that earlier read passed.
          const updateResult = await tx.salesOrder.updateMany({
            where: {
              id: order.id,
              status: SalesOrderStatus.READY,
            },
            data: {
              status: SalesOrderStatus.SHIPPED,
              shippedAt: now,
            },
          });

          if (updateResult.count !== 1) {
            throw new OrderUnavailableError();
          }

          const receivableAmount = items.reduce(
            (total, item) => total.plus(item.quantityKg.mul(item.pricePerKg)),
            new Prisma.Decimal(0),
          );

          const dueDate = new Date(now);
          dueDate.setUTCDate(dueDate.getUTCDate() + order.customer.paymentTermDays);

          const receivable = await tx.receivable.create({
            data: {
              customerId: order.customerId,
              salesOrderId: order.id,
              amount: receivableAmount,
              paidAmount: new Prisma.Decimal(0),
              currency: order.currency,
              dueDate,
              status: FinanceStatus.OPEN,
              reference: order.orderNumber,
            },
          });

          await tx.auditLog.create({
            data: {
              actorId: currentUserId,
              entityType: "Receivable",
              entityId: receivable.id,
              action: "CREATE",
              metadata: {
                salesOrderId: order.id,
                orderNumber: order.orderNumber,
                amount: receivableAmount.toString(),
                currency: order.currency,
                dueDate: dueDate.toISOString(),
                paymentTermDays: order.customer.paymentTermDays,
                status: FinanceStatus.OPEN,
              },
            },
          });

          await tx.auditLog.create({
            data: {
              actorId: currentUserId,
              entityType: "SalesOrder",
              entityId: order.id,
              action: "SHIP",
              metadata: {
                orderNumber: order.orderNumber,
                fromStatus: SalesOrderStatus.READY,
                toStatus: SalesOrderStatus.SHIPPED,
                shippedAt: now.toISOString(),
                itemCount: items.length,
                reservationCount: validatedReservations.length,
                shipmentMovementCount,
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

      return { ok: false, error: "SHIPMENT_FAILED" };
    }
  }

  return { ok: false, error: "SHIPMENT_FAILED" };
}
