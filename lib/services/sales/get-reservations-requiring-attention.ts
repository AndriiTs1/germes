import { ReservationStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToString } from "@/lib/services/sales/decimal";
import { RESERVATION_EXPIRING_SOON_HOURS } from "@/lib/services/sales/config";

export type ReservationAttentionState = "EXPIRED_ACTIVE" | "EXPIRING_SOON" | "ACTIVE";

export type ReservationAttentionItem = {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  quantityKg: string;
  status: string;
  expiresAt: string | null;
  attentionState: ReservationAttentionState;
};

/**
 * ACTIVE reservations belonging to orders owned by currentUserId
 * (StockReservation.salesOrder.responsibleId) — a reservation with no
 * salesOrderId has no owning salesperson signal and is correctly excluded.
 * Batch internals are never exposed even though batchId exists on the row.
 *
 * "EXPIRED_ACTIVE" flags rows whose expiresAt has passed while status is
 * still ACTIVE (see getStockAvailability's doc comment: no expiration job
 * exists yet, so this state is a real, currently-occurring condition, not
 * a hypothetical one) — surfaced for manual review rather than silently
 * excluded or silently still trusted.
 */
export async function getReservationsRequiringAttention(
  currentUserId: string,
): Promise<ReservationAttentionItem[]> {
  const now = new Date();
  const expiringSoonBefore = new Date(
    now.getTime() + RESERVATION_EXPIRING_SOON_HOURS * 60 * 60 * 1000,
  );

  const reservations = await prisma.stockReservation.findMany({
    where: {
      status: ReservationStatus.ACTIVE,
      salesOrder: { responsibleId: currentUserId },
    },
    select: {
      id: true,
      quantityKg: true,
      status: true,
      expiresAt: true,
      salesOrder: {
        select: { id: true, orderNumber: true, customer: { select: { id: true, name: true } } },
      },
      product: { select: { id: true, name: true } },
    },
  });

  const items: ReservationAttentionItem[] = [];

  for (const reservation of reservations) {
    if (!reservation.salesOrder) continue;

    let attentionState: ReservationAttentionState = "ACTIVE";
    if (reservation.expiresAt && reservation.expiresAt < now) {
      attentionState = "EXPIRED_ACTIVE";
    } else if (reservation.expiresAt && reservation.expiresAt <= expiringSoonBefore) {
      attentionState = "EXPIRING_SOON";
    }

    items.push({
      id: reservation.id,
      orderId: reservation.salesOrder.id,
      orderNumber: reservation.salesOrder.orderNumber,
      customerId: reservation.salesOrder.customer.id,
      customerName: reservation.salesOrder.customer.name,
      productId: reservation.product.id,
      productName: reservation.product.name,
      quantityKg: decimalToString(reservation.quantityKg),
      status: reservation.status,
      expiresAt: reservation.expiresAt?.toISOString() ?? null,
      attentionState,
    });
  }

  const priority: Record<ReservationAttentionState, number> = {
    EXPIRED_ACTIVE: 0,
    EXPIRING_SOON: 1,
    ACTIVE: 2,
  };

  items.sort((a, b) => {
    if (priority[a.attentionState] !== priority[b.attentionState]) {
      return priority[a.attentionState] - priority[b.attentionState];
    }
    const aTime = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
    const bTime = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
    return aTime - bTime;
  });

  return items;
}
