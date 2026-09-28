import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { effectiveActiveReservationWhere } from "@/lib/services/sales/reservation-ttl";

/**
 * Physical stock split into its two real parts. There is no receiving
 * workflow ("in transit") and no minimum-stock threshold ("low stock"), so
 * no such segments exist.
 *
 *   physical  = stock from StockMovement (formula below, unchanged)
 *   reserved  = Σ ACTIVE StockReservation.quantityKg
 *   available = physical − reserved
 *
 * The two percentages always add up to 100 (or are both 0 when there is no
 * stock), so Available + Reserved = physical on the ring.
 */
export type InventoryStatusData = {
  /** Physical stock in kg, rounded for display. */
  value: string;
  segments: {
    key: "available" | "reserved";
    pct: number;
    accent: "mint" | "blue";
  }[];
};

export async function getInventoryStatus(now: Date = new Date()): Promise<InventoryStatusData> {
  const movements = await prisma.stockMovement.findMany({
    select: {
      type: true,
      quantityKg: true,
    },
  });

  // Same reserved rule as /sales and Warehouse (reservation-ttl.ts).
  const reservations = await prisma.stockReservation.findMany({
    where: effectiveActiveReservationWhere(now),
    select: {
      quantityKg: true,
    },
  });

  let totalKg = new Prisma.Decimal(0);
  let reservedKg = new Prisma.Decimal(0);

  for (const movement of movements) {
    if (
      movement.type === "RECEIPT" ||
      movement.type === "TRANSFER"
    ) {
      totalKg = totalKg.plus(movement.quantityKg);
    }

    if (
      movement.type === "SHIPMENT" ||
      movement.type === "WRITE_OFF"
    ) {
      totalKg = totalKg.minus(movement.quantityKg);
    }
  }

  for (const reservation of reservations) {
    reservedKg = reservedKg.plus(reservation.quantityKg);
  }

  // Percent of physical stock that is reserved; available is the rest, so
  // the two always sum to 100. Clamped only to keep the ring drawable if the
  // data were ever inconsistent (reserved > physical).
  const reservedPct = totalKg.gt(0)
    ? Math.min(100, Math.max(0, Math.round(reservedKg.div(totalKg).mul(100).toNumber())))
    : 0;
  const availablePct = totalKg.gt(0) ? 100 - reservedPct : 0;

  return {
    value: Math.round(Number(totalKg.toString())).toString(),
    segments: [
      { key: "available", pct: availablePct, accent: "mint" },
      { key: "reserved", pct: reservedPct, accent: "blue" },
    ],
  };
}
