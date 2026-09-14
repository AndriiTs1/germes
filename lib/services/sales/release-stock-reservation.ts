import { ReservationStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type ReleaseStockReservationError =
  | "RESERVATION_UNAVAILABLE"
  | "RELEASE_FAILED";

export type ReleaseStockReservationResult =
  | { ok: true; reservationId: string; salesOrderId: string }
  | { ok: false; error: ReleaseStockReservationError };

class ReservationUnavailableError extends Error {}

/**
 * Releases one ACTIVE stock reservation owned by the current SALES user.
 *
 * V1 rules:
 * - reservation must belong to a SalesOrder whose responsibleId is currentUserId;
 * - reservation must currently be ACTIVE;
 * - ACTIVE -> RELEASED is the only transition handled here;
 * - no role/auth logic here: caller must enforce sales.reservations.release;
 * - updateMany re-asserts ACTIVE status to protect against double release /
 *   stale UI / concurrent requests;
 * - status change and AuditLog are written atomically in one transaction.
 *
 * Releasing a reservation does not change physical inventory. It only stops
 * the reservation from reducing available/free stock.
 */
export async function releaseStockReservation(
  currentUserId: string,
  reservationId: string,
): Promise<ReleaseStockReservationResult> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.stockReservation.findFirst({
        where: {
          id: reservationId,
          status: ReservationStatus.ACTIVE,
          salesOrder: {
            responsibleId: currentUserId,
          },
        },
        select: {
          id: true,
          salesOrderId: true,
          salesOrderItemId: true,
          productId: true,
          batchId: true,
          warehouseId: true,
          quantityKg: true,
          status: true,
        },
      });

      if (!reservation || !reservation.salesOrderId) {
        throw new ReservationUnavailableError();
      }

      const updateResult = await tx.stockReservation.updateMany({
        where: {
          id: reservation.id,
          status: ReservationStatus.ACTIVE,
          salesOrderId: reservation.salesOrderId,
        },
        data: {
          status: ReservationStatus.RELEASED,
        },
      });

      if (updateResult.count !== 1) {
        throw new ReservationUnavailableError();
      }

      await tx.auditLog.create({
        data: {
          actorId: currentUserId,
          entityType: "StockReservation",
          entityId: reservation.id,
          action: "RELEASE",
          metadata: {
            salesOrderId: reservation.salesOrderId,
            salesOrderItemId: reservation.salesOrderItemId,
            productId: reservation.productId,
            batchId: reservation.batchId,
            warehouseId: reservation.warehouseId,
            quantityKg: reservation.quantityKg.toString(),
            fromStatus: reservation.status,
            toStatus: ReservationStatus.RELEASED,
          },
        },
      });

      return {
        reservationId: reservation.id,
        salesOrderId: reservation.salesOrderId,
      };
    });

    return {
      ok: true,
      reservationId: result.reservationId,
      salesOrderId: result.salesOrderId,
    };
  } catch (error) {
    if (error instanceof ReservationUnavailableError) {
      return { ok: false, error: "RESERVATION_UNAVAILABLE" };
    }

    return { ok: false, error: "RELEASE_FAILED" };
  }
}
