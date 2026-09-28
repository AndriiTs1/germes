import { type Prisma, ReservationStatus, SalesOrderStatus } from "@/lib/generated/prisma/client";

/**
 * Read-side mirror of the lifecycle rule: a reservation's 24h TTL only
 * governs it until Warehouse accepts the order. startSalesOrderProcessing
 * expires elapsed reservations of a CONFIRMED order; markSalesOrderReady
 * and shipSalesOrder never look at expiresAt again, so for PROCESSING/READY
 * an ACTIVE reservation stays valid whatever its expiresAt says.
 *
 * Every other order status keeps the plain TTL behaviour.
 */
export function reservationTtlApplies(orderStatus: string): boolean {
  return orderStatus !== SalesOrderStatus.PROCESSING && orderStatus !== SalesOrderStatus.READY;
}

/** An ACTIVE reservation whose TTL has elapsed (expiresAt <= now) and still matters for this order status. */
export function isReservationTtlElapsed(orderStatus: string, expiresAt: Date | null, now: Date): boolean {
  return reservationTtlApplies(orderStatus) && expiresAt !== null && expiresAt.getTime() <= now.getTime();
}

/**
 * Prisma filter for reservations that effectively hold stock right now —
 * the one reserved-quantity rule every read model shares (Sales, Owner
 * Dashboard, Warehouse):
 *
 *   status = ACTIVE AND (
 *     order is PROCESSING / READY          (TTL no longer applies)
 *     OR expiresAt IS NULL                 (no TTL)
 *     OR expiresAt > now                   (TTL still running)
 *   )
 *
 * An elapsed ACTIVE reservation of a CONFIRMED order is therefore not
 * counted, without any write: read paths never run the ACTIVE → EXPIRED
 * transition (only explicit write actions do).
 */
export function effectiveActiveReservationWhere(now: Date): Prisma.StockReservationWhereInput {
  return {
    status: ReservationStatus.ACTIVE,
    OR: [
      { salesOrder: { status: { in: [SalesOrderStatus.PROCESSING, SalesOrderStatus.READY] } } },
      { expiresAt: null },
      { expiresAt: { gt: now } },
    ],
  };
}
