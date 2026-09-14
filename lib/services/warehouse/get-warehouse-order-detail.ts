import { Prisma, ReservationStatus, SalesOrderStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToString } from "@/lib/services/sales/decimal";

export type WarehouseOrderDetailItem = {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  orderedQuantityKg: string;
  usableReservedQuantityKg: string;
  isFullyReserved: boolean;
};

export type WarehouseOrderDetailReservation = {
  id: string;
  salesOrderItemId: string | null;
  productId: string;
  productName: string;
  batchId: string | null;
  batchNumber: string | null;
  warehouseId: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  quantityKg: string;
  status: string;
  expiresAt: string | null;
};

export type WarehouseOrderDetail = {
  id: string;
  orderNumber: string;
  status: string;
  orderDate: string;
  requestedDate: string | null;
  shippedAt: string | null;
  notes: string | null;
  customer: { id: string; code: string; name: string };
  responsible: { id: string; name: string | null } | null;
  items: WarehouseOrderDetailItem[];
  reservations: WarehouseOrderDetailReservation[];
  /** True only when the order has at least one item and every item's own isFullyReserved is true. */
  isFullyReserved: boolean;
};

/** The same lifecycle scope Warehouse can ever see. SHIPPED is included so the terminal, successful Warehouse result stays visible after it leaves the active queue. DRAFT/COMPLETED/CANCELLED are out of Warehouse's scope entirely. */
const WAREHOUSE_VISIBLE_STATUSES: SalesOrderStatus[] = [
  SalesOrderStatus.CONFIRMED,
  SalesOrderStatus.PROCESSING,
  SalesOrderStatus.READY,
  SalesOrderStatus.SHIPPED,
];

/**
 * Warehouse-specific order detail read model — deliberately NOT
 * getSalesOrderDetail(currentUserId, orderId), which intentionally scopes
 * by SalesOrder.responsibleId for salesperson ownership. Warehouse
 * operators work across salespeople, so this takes no currentUserId and
 * applies no responsibleId filtering; scope is status-only
 * (WAREHOUSE_VISIBLE_STATUSES). No auth/permission logic here — the caller
 * (the page) is responsible for requirePermission() and for calling
 * notFound() when this returns null.
 *
 * Pure read: never mutates a reservation, never expires anything, never
 * writes an AuditLog. Every quantity crosses the boundary as a decimal
 * string via decimalToString(), same convention as every other read
 * service.
 *
 * "Usable" fulfillment truth for CONFIRMED/PROCESSING/READY orders is
 * computed the same way the warehouse lifecycle services themselves treat
 * a reservation as counting toward an item — a reservation only counts
 * when ALL of:
 *   - status is exactly ACTIVE
 *   - expiresAt is null OR expiresAt is still in the future (one shared
 *     `now`, matching markSalesOrderReady/shipSalesOrder's own "evaluate,
 *     never mutate" posture for elapsed reservations)
 *   - salesOrderItemId is a valid, exact link to one of this order's own
 *     items (never guessed/repaired — a malformed/legacy link is simply
 *     excluded)
 *   - batchId and warehouseId are both non-null
 *
 * For a SHIPPED order, shipSalesOrder has already transitioned every
 * consumed reservation ACTIVE -> CONSUMED, so this ACTIVE-only usable
 * calculation naturally yields zero for every item — that is the correct,
 * truthful historical state, not a fulfillment failure. All reservation
 * rows (including CONSUMED/RELEASED/EXPIRED ones) are still returned in
 * full so the UI can render that history; this service never hides or
 * discards a reservation row.
 */
export async function getWarehouseOrderDetail(
  salesOrderId: string,
): Promise<WarehouseOrderDetail | null> {
  const order = await prisma.salesOrder.findFirst({
    where: {
      id: salesOrderId,
      status: { in: WAREHOUSE_VISIBLE_STATUSES },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      orderDate: true,
      requestedDate: true,
      shippedAt: true,
      notes: true,
      customer: { select: { id: true, code: true, name: true } },
      responsible: { select: { id: true, name: true } },
      items: {
        select: {
          id: true,
          quantityKg: true,
          product: { select: { id: true, sku: true, name: true } },
        },
      },
      reservations: {
        select: {
          id: true,
          salesOrderItemId: true,
          quantityKg: true,
          status: true,
          expiresAt: true,
          product: { select: { id: true, name: true } },
          batch: { select: { id: true, batchNumber: true } },
          warehouse: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });

  if (!order) return null;

  const now = new Date();
  const itemById = new Map(order.items.map((item) => [item.id, item]));

  const usableReservedByItemId = new Map<string, Prisma.Decimal>();

  for (const reservation of order.reservations) {
    if (reservation.status !== ReservationStatus.ACTIVE) continue;
    if (reservation.expiresAt !== null && reservation.expiresAt <= now) continue;
    if (!reservation.salesOrderItemId) continue;
    if (!itemById.has(reservation.salesOrderItemId)) continue;
    if (!reservation.batch) continue;
    if (!reservation.warehouse) continue;

    const current =
      usableReservedByItemId.get(reservation.salesOrderItemId) ?? new Prisma.Decimal(0);
    usableReservedByItemId.set(
      reservation.salesOrderItemId,
      current.plus(reservation.quantityKg),
    );
  }

  let fullyReservedItemCount = 0;

  const items: WarehouseOrderDetailItem[] = order.items.map((item) => {
    const usableReservedKg = usableReservedByItemId.get(item.id) ?? new Prisma.Decimal(0);
    const isItemFullyReserved = usableReservedKg.equals(item.quantityKg);

    if (isItemFullyReserved) {
      fullyReservedItemCount += 1;
    }

    return {
      id: item.id,
      productId: item.product.id,
      sku: item.product.sku,
      productName: item.product.name,
      orderedQuantityKg: decimalToString(item.quantityKg),
      usableReservedQuantityKg: decimalToString(usableReservedKg),
      isFullyReserved: isItemFullyReserved,
    };
  });

  const isFullyReserved = order.items.length > 0 && fullyReservedItemCount === order.items.length;

  const reservations: WarehouseOrderDetailReservation[] = order.reservations.map(
    (reservation) => ({
      id: reservation.id,
      salesOrderItemId: reservation.salesOrderItemId,
      productId: reservation.product.id,
      productName: reservation.product.name,
      batchId: reservation.batch?.id ?? null,
      batchNumber: reservation.batch?.batchNumber ?? null,
      warehouseId: reservation.warehouse?.id ?? null,
      warehouseCode: reservation.warehouse?.code ?? null,
      warehouseName: reservation.warehouse?.name ?? null,
      quantityKg: decimalToString(reservation.quantityKg),
      status: reservation.status,
      expiresAt: reservation.expiresAt?.toISOString() ?? null,
    }),
  );

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    orderDate: order.orderDate.toISOString(),
    requestedDate: order.requestedDate?.toISOString() ?? null,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    notes: order.notes,
    customer: order.customer,
    responsible: order.responsible,
    items,
    reservations,
    isFullyReserved,
  };
}
