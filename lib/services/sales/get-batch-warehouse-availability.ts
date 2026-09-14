import { BatchStatus, Prisma, ReservationStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToString } from "@/lib/services/sales/decimal";

export type BatchWarehouseAvailability = {
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
 * Returns sellable stock for one product broken down by batch + warehouse.
 *
 * Physical stock is derived from StockMovement:
 * - toWarehouseId   => add quantity
 * - fromWarehouseId => subtract quantity
 *
 * Only AVAILABLE batches are exposed.
 *
 * ACTIVE reservations with a concrete warehouseId are subtracted from
 * that warehouse/batch pair. Legacy reservations without warehouseId are
 * deliberately not guessed here; reservation creation will perform an
 * additional batch-level safety check so old unallocated reservations
 * cannot cause the batch to be oversold.
 */
export async function getBatchWarehouseAvailability(
  productId: string,
): Promise<BatchWarehouseAvailability[]> {
  const [movements, reservations] = await Promise.all([
    prisma.stockMovement.findMany({
      where: {
        batch: {
          productId,
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
        productId,
        status: ReservationStatus.ACTIVE,
        warehouseId: { not: null },
        batchId: { not: null },
      },
      select: {
        batchId: true,
        warehouseId: true,
        quantityKg: true,
      },
    }),
  ]);

  type Bucket = {
    batchId: string;
    batchNumber: string;
    warehouseId: string;
    warehouseCode: string;
    warehouseName: string;
    onHandKg: Prisma.Decimal;
  };

  const buckets = new Map<string, Bucket>();

  function applyMovement(
    batchId: string,
    batchNumber: string,
    warehouse: {
      id: string;
      code: string;
      name: string;
      isActive: boolean;
    } | null,
    quantityKg: Prisma.Decimal,
  ) {
    if (!warehouse || !warehouse.isActive) return;

    const key = `${batchId}:${warehouse.id}`;
    const existing = buckets.get(key);

    if (existing) {
      existing.onHandKg = existing.onHandKg.plus(quantityKg);
      return;
    }

    buckets.set(key, {
      batchId,
      batchNumber,
      warehouseId: warehouse.id,
      warehouseCode: warehouse.code,
      warehouseName: warehouse.name,
      onHandKg: quantityKg,
    });
  }

  for (const movement of movements) {
    if (movement.toWarehouseId) {
      applyMovement(
        movement.batchId,
        movement.batch.batchNumber,
        movement.toWarehouse,
        movement.quantityKg,
      );
    }

    if (movement.fromWarehouseId) {
      applyMovement(
        movement.batchId,
        movement.batch.batchNumber,
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
      const warehouse = a.warehouseName.localeCompare(b.warehouseName);
      if (warehouse !== 0) return warehouse;
      return a.batchNumber.localeCompare(b.batchNumber);
    });
}
