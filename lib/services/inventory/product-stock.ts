import { BatchStatus, Prisma } from "@/lib/generated/prisma/client";

/**
 * Only BatchStatus.AVAILABLE permits sale. The other three values —
 * QUARANTINE (held pending inspection), BLOCKED (deliberately blocked),
 * DEPLETED (already exhausted) — all describe non-sellable states by their
 * own names; none of them mean "OK to sell".
 */
export const SELLABLE_BATCH_STATUS = BatchStatus.AVAILABLE;

/**
 * The one company-wide on-hand rule, shared by Sales, Warehouse, Products
 * and the Command Center: a movement adds quantityKg to toWarehouseId (if
 * set) and subtracts it from fromWarehouseId (if set). This reproduces
 * RECEIPT (+to only), SHIPMENT (−from only), WRITE_OFF (−from only) and
 * TRANSFER (−from +to, i.e. zero net for the company), and reads each
 * ADJUSTMENT's own from/to fields rather than guessing a sign for its type.
 */
export function movementNetKg(movement: {
  fromWarehouseId: string | null;
  toWarehouseId: string | null;
  quantityKg: Prisma.Decimal;
}): Prisma.Decimal {
  let net = new Prisma.Decimal(0);
  if (movement.toWarehouseId) net = net.plus(movement.quantityKg);
  if (movement.fromWarehouseId) net = net.minus(movement.quantityKg);
  return net;
}

export type ProductStockMovement = {
  fromWarehouseId: string | null;
  toWarehouseId: string | null;
  quantityKg: Prisma.Decimal;
  batch: { productId: string; status: BatchStatus };
};

export type ProductStockReservation = {
  productId: string;
  quantityKg: Prisma.Decimal;
  batchId: string | null;
  batch: { status: BatchStatus } | null;
};

export type ProductStockTotals = {
  /** All batches, any status — actual physical company stock. */
  physicalOnHand: Prisma.Decimal;
  /** Same aggregation, restricted to AVAILABLE-status batches only. */
  sellableOnHand: Prisma.Decimal;
  /** Effective-active reservations counted against sellableOnHand. */
  reserved: Prisma.Decimal;
  /** Effective-active reservations tied to a non-sellable batch — not subtracted, a data-quality signal. */
  inconsistentReserved: Prisma.Decimal;
  /** sellableOnHand − reserved. Never clamped at zero. */
  available: Prisma.Decimal;
};

export function emptyProductStockTotals(): ProductStockTotals {
  const zero = new Prisma.Decimal(0);
  return { physicalOnHand: zero, sellableOnHand: zero, reserved: zero, inconsistentReserved: zero, available: zero };
}

/**
 * Pure per-product aggregation (no database). `reservations` must already
 * be filtered to effectively-active ones (effectiveActiveReservationWhere).
 * Reservations are attributed to the sellable pool by batch linkage:
 *   - no batchId: subtracted (product-level hold, assumed to draw from sellable stock);
 *   - batchId on an AVAILABLE batch: subtracted;
 *   - batchId on a non-sellable batch: NOT subtracted, reported as inconsistentReserved.
 * Products with no movements and no reservations are simply absent from
 * the result — callers fall back to emptyProductStockTotals().
 */
export function aggregateProductStock(
  movements: ProductStockMovement[],
  reservations: ProductStockReservation[],
): Map<string, ProductStockTotals> {
  const totals = new Map<string, ProductStockTotals>();
  const get = (productId: string) => {
    let entry = totals.get(productId);
    if (!entry) totals.set(productId, (entry = emptyProductStockTotals()));
    return entry;
  };

  for (const movement of movements) {
    const entry = get(movement.batch.productId);
    const net = movementNetKg(movement);
    entry.physicalOnHand = entry.physicalOnHand.plus(net);
    if (movement.batch.status === SELLABLE_BATCH_STATUS) entry.sellableOnHand = entry.sellableOnHand.plus(net);
  }

  for (const reservation of reservations) {
    const entry = get(reservation.productId);
    const tiedToNonSellableBatch =
      reservation.batchId !== null && reservation.batch?.status !== SELLABLE_BATCH_STATUS;
    if (tiedToNonSellableBatch) {
      entry.inconsistentReserved = entry.inconsistentReserved.plus(reservation.quantityKg);
    } else {
      entry.reserved = entry.reserved.plus(reservation.quantityKg);
    }
  }

  for (const entry of totals.values()) entry.available = entry.sellableOnHand.minus(entry.reserved);

  return totals;
}
