import { ReservationStatus, SalesOrderStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type ExpireStockReservationsResult = {
  expiredCount: number;
};

/**
 * Expires all reservations whose TTL has elapsed.
 *
 * V1 rules:
 * - only ACTIVE reservations are eligible;
 * - expiresAt must be non-null and <= now;
 * - order-linked reservations expire automatically only while their SalesOrder
 *   is CONFIRMED; once Warehouse accepts the order into PROCESSING, its
 *   fulfillment reservation is protected from TTL cleanup;
 * - reservations not linked to a SalesOrder keep the normal TTL behaviour;
 * - ACTIVE -> EXPIRED is the only transition performed here;
 * - repeated execution is safe: already expired/released/consumed rows are ignored;
 * - expiration changes reservation state only, never physical stock;
 * - every expired reservation receives an AuditLog row;
 * - status updates and audit rows are written atomically in one transaction.
 *
 * This service contains no auth/permission logic. It is infrastructure/business
 * logic and may be called from server-side reservation flows or a future
 * scheduled cleanup job.
 */
export async function expireStockReservations(
  now = new Date(),
): Promise<ExpireStockReservationsResult> {
  return prisma.$transaction(async (tx) => {
    const candidates = await tx.stockReservation.findMany({
      where: {
        status: ReservationStatus.ACTIVE,
        expiresAt: {
          not: null,
          lte: now,
        },
        OR: [
          { salesOrderId: null },
          { salesOrder: { status: SalesOrderStatus.CONFIRMED } },
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

    let expiredCount = 0;

    for (const reservation of candidates) {
      const updateResult = await tx.stockReservation.updateMany({
        where: {
          id: reservation.id,
          status: ReservationStatus.ACTIVE,
          expiresAt: {
            not: null,
            lte: now,
          },
          OR: [
            { salesOrderId: null },
            { salesOrder: { status: SalesOrderStatus.CONFIRMED } },
          ],
        },
        data: {
          status: ReservationStatus.EXPIRED,
        },
      });

      if (updateResult.count !== 1) {
        continue;
      }

      expiredCount++;

      await tx.auditLog.create({
        data: {
          actorId: null,
          entityType: "StockReservation",
          entityId: reservation.id,
          action: "EXPIRE",
          metadata: {
            salesOrderId: reservation.salesOrderId,
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

    return { expiredCount };
  });
}
