import { BatchStatus, Prisma, ReservationStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToString } from "@/lib/services/sales/decimal";

export type WarehouseBatchStockRow = {
  productId: string;
  productSku: string;
  productName: string;
  batchId: string;
  batchNumber: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  onHandKg: string;
  activeReservedKg: string;
  availableKg: string;
};

/**
 * Warehouse-wide sellable stock broken down by product + batch + warehouse.
 *
 * Physical stock is derived from StockMovement using the same semantics as
 * getBatchWarehouseAvailability(), but all products are loaded in bulk to
 * avoid an N+1 query pattern on the Warehouse workspace.
 *
 * Only AVAILABLE batches and active warehouses are exposed.
 * ACTIVE reservations are attributed only when both batchId and warehouseId
 * are present. Legacy unallocated reservations are deliberately not guessed.
 */
export async function listBatchWarehouseStock(): Promise<WarehouseBatchStockRow[]> {
  const [movements, reservations] = await Promise.all([
    prisma.stockMovement.findMany({
      where: {
        batch: {
          status: BatchStatus.AVAILABLE,
        },
      },
      select: {
        batchId: true,
        fromWarehouseId: true,
        toWarehouseId: true,
        quantityKg: true,
        batch: {
          select: {
            batchNumber: true,
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
              },
            },
          },
        },
        fromWarehouse: {
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
          },
        },
        toWarehouse: {
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
          },
        },
      },
    }),
    prisma.stockReservation.findMany({
      where: {
        status: ReservationStatus.ACTIVE,
        warehouseId: { not: null },
        batchId: { not: null },
        batch: {
          status: BatchStatus.AVAILABLE,
        },
      },
      select: {
        batchId: true,
        warehouseId: true,
        quantityKg: true,
      },
    }),
  ]);

  type Bucket = {
    productId: string;
    productSku: string;
    productName: string;
    batchId: string;
    batchNumber: string;
    warehouseId: string;
    warehouseCode: string;
    warehouseName: string;
    onHandKg: Prisma.Decimal;
  };

  const buckets = new Map<string, Bucket>();

  function applyMovement(
    movement: (typeof movements)[number],
    warehouse: {
      id: string;
      code: string;
      name: string;
      isActive: boolean;
    } | null,
    quantityKg: Prisma.Decimal,
  ) {
    if (!warehouse || !warehouse.isActive) return;

    const key = `${movement.batchId}:${warehouse.id}`;
    const existing = buckets.get(key);

    if (existing) {
      existing.onHandKg = existing.onHandKg.plus(quantityKg);
      return;
    }

    buckets.set(key, {
      productId: movement.batch.product.id,
      productSku: movement.batch.product.sku,
      productName: movement.batch.product.name,
      batchId: movement.batchId,
      batchNumber: movement.batch.batchNumber,
      warehouseId: warehouse.id,
      warehouseCode: warehouse.code,
      warehouseName: warehouse.name,
      onHandKg: quantityKg,
    });
  }

  for (const movement of movements) {
    if (movement.toWarehouseId) {
      applyMovement(movement, movement.toWarehouse, movement.quantityKg);
    }

    if (movement.fromWarehouseId) {
      applyMovement(
        movement,
        movement.fromWarehouse,
        movement.quantityKg.negated(),
      );
    }
  }

  const reservedByBucket = new Map<string, Prisma.Decimal>();

  for (const reservation of reservations) {
    if (!reservation.batchId || !reservation.warehouseId) continue;

    const key = `${reservation.batchId}:${reservation.warehouseId}`;
    const current = reservedByBucket.get(key) ?? new Prisma.Decimal(0);

    reservedByBucket.set(key, current.plus(reservation.quantityKg));
  }

  return Array.from(buckets.values())
    .map((bucket) => {
      const reserved =
        reservedByBucket.get(`${bucket.batchId}:${bucket.warehouseId}`) ??
        new Prisma.Decimal(0);

      return {
        productId: bucket.productId,
        productSku: bucket.productSku,
        productName: bucket.productName,
        batchId: bucket.batchId,
        batchNumber: bucket.batchNumber,
        warehouseId: bucket.warehouseId,
        warehouseCode: bucket.warehouseCode,
        warehouseName: bucket.warehouseName,
        onHandKg: decimalToString(bucket.onHandKg),
        activeReservedKg: decimalToString(reserved),
        availableKg: decimalToString(bucket.onHandKg.minus(reserved)),
      };
    })
    .filter((row) => new Prisma.Decimal(row.onHandKg).gt(0))
    .sort((a, b) => {
      const product = a.productName.localeCompare(b.productName);
      if (product !== 0) return product;

      const warehouse = a.warehouseName.localeCompare(b.warehouseName);
      if (warehouse !== 0) return warehouse;

      return a.batchNumber.localeCompare(b.batchNumber);
    });
}
