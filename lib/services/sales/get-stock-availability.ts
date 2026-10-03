import { prisma } from "@/lib/db/prisma";
import { aggregateProductStock, emptyProductStockTotals } from "@/lib/services/inventory/product-stock";
import { effectiveActiveReservationWhere } from "@/lib/services/sales/reservation-ttl";
import { decimalToString } from "@/lib/services/sales/decimal";

export type ProductStockAvailability = {
  productId: string;
  sku: string;
  name: string;
  /** All batches, any status — actual physical company stock. */
  physicalOnHandKg: string;
  /** Same aggregation, restricted to AVAILABLE-status batches only. */
  sellableOnHandKg: string;
  /** ACTIVE reservations actually counted against sellableOnHandKg. */
  activeReservedKg: string;
  /**
   * ACTIVE reservations tied to a non-sellable batch (QUARANTINE/BLOCKED/
   * DEPLETED). Not subtracted from sellableOnHandKg — that stock was never
   * counted as sellable in the first place, so subtracting it too would
   * double-reduce availability. Surfaced here as a data-quality signal: a
   * reservation should not exist against stock that can't be sold, and
   * this needs future operational handling (release/reassign), not silent
   * disappearance.
   */
  inconsistentReservedKg: string;
  /** sellableOnHandKg - activeReservedKg. Never clamped at zero. */
  availableKg: string;
};

/**
 * Available-to-sell stock per product, aggregated across all warehouses.
 * Not scoped to a salesperson — physical stock is a company-wide fact.
 *
 * The aggregation itself lives in aggregateProductStock
 * (lib/services/inventory/product-stock.ts) and is shared with the Products
 * catalog and the Command Center, so every screen counts stock the same way.
 *
 * On-hand is derived purely from StockMovement, generically for every
 * movement type: a row's quantityKg is added to toWarehouseId (if set)
 * and subtracted from fromWarehouseId (if set). This reproduces the
 * documented RECEIPT (+to only), SHIPMENT (-from only), TRANSFER (-from
 * +to), and WRITE_OFF (-from only) semantics exactly, and is also the
 * safe resolution for ADJUSTMENT: no seed row of that type exists and the
 * schema defines no fixed sign for it, so rather than guessing a
 * direction, each row's own from/to fields are read literally — the same
 * rule already governing every other type. This same aggregation is run
 * twice: once across all batches (physicalOnHandKg) and once restricted
 * to AVAILABLE batches only (sellableOnHandKg).
 *
 * Reservations are attributed to the sellable pool by batch linkage:
 *   - no batchId: subtracted from sellableOnHandKg (product-level hold,
 *     no batch to check, so it's assumed to draw from sellable stock).
 *   - batchId pointing at an AVAILABLE batch: subtracted normally.
 *   - batchId pointing at a non-sellable batch: NOT subtracted from
 *     sellableOnHandKg, and reported separately in inconsistentReservedKg.
 *
 * Active reservations counted against sellable stock are subtracted
 * regardless of expiresAt: no expiration/release job exists anywhere in
 * this codebase today, so an ACTIVE row past its expiresAt is still the
 * authoritative "stock is held" state in the database. Treating it as
 * already lapsed here would risk overselling; expired-but-still-ACTIVE
 * rows are instead surfaced separately by getReservationsRequiringAttention
 * for human review.
 *
 * Never exposes warehouse breakdown, batch details, or cost/supplier
 * information — aggregate quantities only, per SALES's permission scope.
 * availableKg is not clamped at zero: a negative value indicates bad data
 * (over-reservation) and should stay visible, not hidden.
 */
export async function getStockAvailability(now: Date = new Date()): Promise<ProductStockAvailability[]> {
  const [products, movements, reservations] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, sku: true, name: true },
    }),
    prisma.stockMovement.findMany({
      select: {
        fromWarehouseId: true,
        toWarehouseId: true,
        quantityKg: true,
        batch: { select: { productId: true, status: true } },
      },
    }),
    prisma.stockReservation.findMany({
      where: effectiveActiveReservationWhere(now),
      select: {
        productId: true,
        quantityKg: true,
        batchId: true,
        batch: { select: { status: true } },
      },
    }),
  ]);

  const totalsByProduct = aggregateProductStock(movements, reservations);

  return products.map((product) => {
    const totals = totalsByProduct.get(product.id) ?? emptyProductStockTotals();

    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      physicalOnHandKg: decimalToString(totals.physicalOnHand),
      sellableOnHandKg: decimalToString(totals.sellableOnHand),
      activeReservedKg: decimalToString(totals.reserved),
      inconsistentReservedKg: decimalToString(totals.inconsistentReserved),
      availableKg: decimalToString(totals.available),
    };
  });
}
