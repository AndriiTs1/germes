import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

/** How many products the card lists. */
const LOWEST_STOCK_LIMIT = 3;

/**
 * The active products with the lowest current stock — a plain fact, not a
 * procurement recommendation (there is no reorder point / minimum stock).
 * `value` is the number of products actually listed.
 */
export type ProcurementNeedsData = {
  value: string;
  items: {
    sku: string;
    name: string;
    stockKg: number;
    /** Stock is exactly zero. No other threshold exists, so nothing else is flagged. */
    outOfStock: boolean;
    /** 0 < exact stock < 1 kg — shown as "<1", since the rounded value would read as zero. */
    belowOneKg: boolean;
  }[];
};

export async function getProcurementNeeds(): Promise<ProcurementNeedsData> {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      sku: true,
      name: true,
      batches: {
        select: {
          id: true,
          stockMovements: {
            select: {
              type: true,
              quantityKg: true,
            },
          },
        },
      },
    },
  });

  const rows: { id: string; sku: string; name: string; stock: Prisma.Decimal }[] = [];

  for (const product of products) {
    let stock = new Prisma.Decimal(0);

    for (const batch of product.batches) {
      for (const movement of batch.stockMovements) {
        if (
          movement.type === "RECEIPT" ||
          movement.type === "TRANSFER"
        ) {
          stock = stock.plus(movement.quantityKg);
        }

        if (
          movement.type === "SHIPMENT" ||
          movement.type === "WRITE_OFF"
        ) {
          stock = stock.minus(movement.quantityKg);
        }
      }
    }

    rows.push({ id: product.id, sku: product.sku, name: product.name, stock });
  }

  // Exact stock ascending; equal stock never falls back to database order:
  // SKU, then id, decide.
  rows.sort(
    (a, b) =>
      a.stock.comparedTo(b.stock) ||
      (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  const limitedItems = rows.slice(0, LOWEST_STOCK_LIMIT).map((row) => ({
    sku: row.sku,
    name: row.name,
    stockKg: Math.round(Number(row.stock.toString())),
    outOfStock: row.stock.isZero(),
    belowOneKg: row.stock.gt(0) && row.stock.lt(1),
  }));

  return {
    value: limitedItems.length.toString(),
    items: limitedItems,
  };
}
