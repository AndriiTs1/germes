import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  aggregateProductStock,
  emptyProductStockTotals,
  type ProductStockMovement,
} from "@/lib/services/inventory/product-stock";
import { decimalToString } from "@/lib/services/sales/decimal";
import { effectiveActiveReservationWhere } from "@/lib/services/sales/reservation-ttl";

export type ProductStockSummary = {
  /** All batches, any status — physical company stock (same as getStockAvailability.physicalOnHandKg). */
  onHandKg: string;
  /** Physical stock on QUARANTINE/BLOCKED/DEPLETED batches — part of onHandKg, never sellable. */
  notSellableKg: string;
  /** Reservations counted against sellable stock (same as getStockAvailability.activeReservedKg). */
  reservedKg: string;
  /** Sellable stock minus reserved, never clamped (same as getStockAvailability.availableKg). */
  availableKg: string;
};

/**
 * Company-wide stock for an explicit set of products — the current
 * /products page only, never the whole catalog. Uses the exact same
 * aggregation as getStockAvailability (aggregateProductStock) and the same
 * effective-active reservation rule, so a product shows identical numbers
 * on /products, /sales, /warehouse (total) and the Command Center.
 *
 * Three bounded queries regardless of page size (no per-product query):
 *   1. batches of these products (id → productId, status);
 *   2. effective-active reservations of these products;
 *   3. StockMovement summed in the database per (batch, from, to) for
 *      those batches — summing within a group is exactly what the
 *      row-by-row from/to rule would do, without loading every movement.
 * A product with no batches/movements gets zeros. Every requested id is
 * present in the result.
 */
export async function getProductStockSummaries(
  productIds: string[],
  now: Date = new Date(),
): Promise<Record<string, ProductStockSummary>> {
  if (productIds.length === 0) return {};

  const [batches, reservations] = await Promise.all([
    prisma.batch.findMany({
      where: { productId: { in: productIds } },
      select: { id: true, productId: true, status: true },
    }),
    prisma.stockReservation.findMany({
      where: { ...effectiveActiveReservationWhere(now), productId: { in: productIds } },
      select: {
        productId: true,
        quantityKg: true,
        batchId: true,
        batch: { select: { status: true } },
      },
    }),
  ]);

  const batchById = new Map(batches.map((batch) => [batch.id, batch]));

  const groups =
    batches.length === 0
      ? []
      : await prisma.stockMovement.groupBy({
          by: ["batchId", "fromWarehouseId", "toWarehouseId"],
          where: { batchId: { in: batches.map((batch) => batch.id) } },
          _sum: { quantityKg: true },
        });

  const movements: ProductStockMovement[] = groups.flatMap((group) => {
    const batch = batchById.get(group.batchId);
    if (!batch) return [];
    return [
      {
        fromWarehouseId: group.fromWarehouseId,
        toWarehouseId: group.toWarehouseId,
        quantityKg: group._sum.quantityKg ?? new Prisma.Decimal(0),
        batch: { productId: batch.productId, status: batch.status },
      },
    ];
  });

  const totalsByProduct = aggregateProductStock(movements, reservations);

  return Object.fromEntries(
    productIds.map((productId) => {
      const totals = totalsByProduct.get(productId) ?? emptyProductStockTotals();
      return [
        productId,
        {
          onHandKg: decimalToString(totals.physicalOnHand),
          notSellableKg: decimalToString(totals.physicalOnHand.minus(totals.sellableOnHand)),
          reservedKg: decimalToString(totals.reserved),
          availableKg: decimalToString(totals.available),
        },
      ];
    }),
  );
}
