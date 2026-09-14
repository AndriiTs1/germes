import { Prisma, ReservationStatus, SalesOrderStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToString } from "@/lib/services/sales/decimal";

export type WarehouseOrderQueueItem = {
  id: string;
  orderNumber: string;
  status: string;
  orderDate: string;
  requestedDate: string | null;
  customer: {
    id: string;
    code: string;
    name: string;
  };
  itemCount: number;
  totalQuantityKg: string;
  activeReservationCount: number;
  reservedQuantityKg: string;
  fullyReservedItemCount: number;
  totalItemCount: number;
  isFullyReserved: boolean;
};

/** The only statuses Warehouse has active work for. DRAFT is not yet actionable by Warehouse; SHIPPED/COMPLETED/CANCELLED are no longer active work. */
const QUEUE_STATUSES: SalesOrderStatus[] = [
  SalesOrderStatus.CONFIRMED,
  SalesOrderStatus.PROCESSING,
  SalesOrderStatus.READY,
];

/** Operational priority — READY first (closest to shipping), then PROCESSING, then CONFIRMED (not yet started). Deliberately NOT the enum's declaration order. */
const STATUS_PRIORITY: Record<string, number> = {
  [SalesOrderStatus.READY]: 0,
  [SalesOrderStatus.PROCESSING]: 1,
  [SalesOrderStatus.CONFIRMED]: 2,
};

/**
 * Authoritative read model for the Warehouse active work queue.
 *
 * Warehouse operators work across salespeople — this deliberately does NOT
 * take a currentUserId and does NOT scope SalesOrder by responsibleId
 * (contrast listSalesOrders, which is scoped to one salesperson's own
 * orders). No auth/permission logic lives here; the future /warehouse page
 * is responsible for independently requiring the appropriate warehouse
 * permission before calling this.
 *
 * Scope is exactly CONFIRMED | PROCESSING | READY (see QUEUE_STATUSES).
 * Ordering is READY, then PROCESSING, then CONFIRMED; within the same
 * status: requestedDate ascending (nulls last), then orderDate ascending,
 * then id ascending as a deterministic tie-breaker. This priority/nulls-last
 * shape doesn't map cleanly onto a single Prisma orderBy, so the scoped
 * rows are fetched once and sorted in TypeScript instead of via raw SQL.
 *
 * This is a pure read: it never mutates a reservation (no ACTIVE -> EXPIRED
 * transition, no AuditLog) — exactly the same "evaluate, never mutate"
 * posture as markSalesOrderReady/shipSalesOrder's own expiration handling,
 * just without a transaction since nothing is written here. A shared `now`
 * is still used so an ACTIVE reservation whose expiresAt <= now is excluded
 * from every fulfillment calculation below, preventing the Warehouse UI
 * from showing an expired allocation as fulfillment-ready even if lazy
 * expiration housekeeping hasn't run yet.
 *
 * Reservations are read through each SalesOrderItem's own `reservations`
 * relation (its foreign key is salesOrderItemId), so a legacy/malformed
 * ACTIVE reservation with a null salesOrderItemId is never reachable here
 * at all and therefore never guessed into counting toward any item's
 * reserved quantity — the read model stays truthful rather than attempting
 * repair. isFullyReserved is true only when the order has at least one item
 * and every item's ACTIVE (non-elapsed) reservations sum to exactly its
 * quantityKg (Prisma.Decimal equality) — an order with zero items is never
 * considered fully reserved.
 */
export async function listWarehouseOrders(): Promise<WarehouseOrderQueueItem[]> {
  const now = new Date();

  const orders = await prisma.salesOrder.findMany({
    where: { status: { in: QUEUE_STATUSES } },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      orderDate: true,
      requestedDate: true,
      customer: { select: { id: true, code: true, name: true } },
      items: {
        select: {
          id: true,
          quantityKg: true,
          reservations: {
            where: { status: ReservationStatus.ACTIVE },
            select: { quantityKg: true, expiresAt: true },
          },
        },
      },
    },
  });

  const queueItems: WarehouseOrderQueueItem[] = orders.map((order) => {
    let totalQuantityKg = new Prisma.Decimal(0);
    let reservedQuantityKg = new Prisma.Decimal(0);
    let activeReservationCount = 0;
    let fullyReservedItemCount = 0;

    for (const item of order.items) {
      totalQuantityKg = totalQuantityKg.plus(item.quantityKg);

      let itemReservedKg = new Prisma.Decimal(0);

      for (const reservation of item.reservations) {
        // An elapsed ACTIVE reservation must not count as usable
        // fulfillment in this read model, even though it is never mutated
        // here.
        if (reservation.expiresAt !== null && reservation.expiresAt <= now) {
          continue;
        }

        itemReservedKg = itemReservedKg.plus(reservation.quantityKg);
        reservedQuantityKg = reservedQuantityKg.plus(reservation.quantityKg);
        activeReservationCount += 1;
      }

      if (itemReservedKg.equals(item.quantityKg)) {
        fullyReservedItemCount += 1;
      }
    }

    const totalItemCount = order.items.length;
    const isFullyReserved = totalItemCount > 0 && fullyReservedItemCount === totalItemCount;

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      orderDate: order.orderDate.toISOString(),
      requestedDate: order.requestedDate?.toISOString() ?? null,
      customer: {
        id: order.customer.id,
        code: order.customer.code,
        name: order.customer.name,
      },
      itemCount: totalItemCount,
      totalQuantityKg: decimalToString(totalQuantityKg),
      activeReservationCount,
      reservedQuantityKg: decimalToString(reservedQuantityKg),
      fullyReservedItemCount,
      totalItemCount,
      isFullyReserved,
    };
  });

  queueItems.sort((a, b) => {
    const statusDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (statusDiff !== 0) return statusDiff;

    const aRequested = a.requestedDate ? new Date(a.requestedDate).getTime() : null;
    const bRequested = b.requestedDate ? new Date(b.requestedDate).getTime() : null;

    if (aRequested !== bRequested) {
      if (aRequested === null) return 1;
      if (bRequested === null) return -1;
      return aRequested - bRequested;
    }

    const orderDateDiff = new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
    if (orderDateDiff !== 0) return orderDateDiff;

    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  return queueItems;
}
