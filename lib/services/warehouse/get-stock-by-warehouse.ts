import { BatchStatus, Prisma, ReservationStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToString } from "@/lib/services/sales/decimal";

export type StockCell = {
  /** All batches, any status — physical stock. */
  onHandKg: string;
  /** AVAILABLE batches only. */
  sellableOnHandKg: string;
  /** ACTIVE reservations counted against sellable stock. */
  reservedKg: string;
  /** sellableOnHandKg - reservedKg. Never clamped at zero. */
  availableKg: string;
};

export type StockByWarehouseRow = {
  productId: string;
  sku: string;
  name: string;
  /** Keyed by warehouseId; present for every active warehouse, zeros included. */
  byWarehouse: Record<string, StockCell>;
  /** Company-wide: every active warehouse + inactive warehouses + unallocated reservations. */
  total: StockCell;
  /** ACTIVE reservations with no warehouseId — subtracted from total only, never guessed into a warehouse. */
  unallocatedReservedKg: string;
  /** ACTIVE reservations on a non-sellable batch — not subtracted (same rule as getStockAvailability). */
  inconsistentReservedKg: string;
  /** Physical stock on warehouses not in `warehouses` (inactive) — counted in total, no column of its own. */
  inactiveWarehouseOnHandKg: string;
};

export type StockByWarehouse = {
  warehouses: { id: string; code: string; name: string }[];
  rows: StockByWarehouseRow[];
};

export type StockByWarehouseInput = {
  products: { id: string; sku: string; name: string }[];
  warehouses: { id: string; code: string; name: string }[];
  movements: {
    fromWarehouseId: string | null;
    toWarehouseId: string | null;
    quantityKg: Prisma.Decimal;
    batch: { productId: string; status: BatchStatus };
  }[];
  reservations: {
    productId: string;
    warehouseId: string | null;
    batchId: string | null;
    quantityKg: Prisma.Decimal;
    batch: { status: BatchStatus } | null;
  }[];
};

type Acc = { onHand: Prisma.Decimal; sellable: Prisma.Decimal; reserved: Prisma.Decimal };

const zero = () => new Prisma.Decimal(0);
const emptyAcc = (): Acc => ({ onHand: zero(), sellable: zero(), reserved: zero() });

function toCell(acc: Acc): StockCell {
  return {
    onHandKg: decimalToString(acc.onHand),
    sellableOnHandKg: decimalToString(acc.sellable),
    reservedKg: decimalToString(acc.reserved),
    availableKg: decimalToString(acc.sellable.minus(acc.reserved)),
  };
}

/**
 * Pure aggregation (no database) so the rules can be exercised on synthetic
 * data. Mirrors getStockAvailability exactly for the company total, and
 * listBatchWarehouseStock for the per-warehouse attribution:
 *   - each movement adds quantityKg to toWarehouseId (if set) and subtracts
 *     it from fromWarehouseId (if set) — RECEIPT/SHIPMENT/TRANSFER/WRITE_OFF/
 *     ADJUSTMENT all follow from their own from/to fields, no guessed signs;
 *   - onHand counts every batch, sellable only BatchStatus.AVAILABLE;
 *   - an ACTIVE reservation on a non-sellable batch is inconsistent and not
 *     subtracted; otherwise it is subtracted from its warehouse when
 *     warehouseId is set, or held as "unallocated" (total only) when not.
 * Stock moved to/from a warehouse not in `warehouses` (inactive) is kept in
 * the total so it always equals getStockAvailability.
 */
export function aggregateStockByWarehouse(input: StockByWarehouseInput): StockByWarehouse {
  const warehouseIds = new Set(input.warehouses.map((w) => w.id));
  const perCell = new Map<string, Acc>(); // `${productId}:${warehouseId}`
  const perTotal = new Map<string, Acc>(); // productId
  const unallocated = new Map<string, Prisma.Decimal>();
  const inconsistent = new Map<string, Prisma.Decimal>();
  const inactiveOnHand = new Map<string, Prisma.Decimal>();

  const cell = (productId: string, warehouseId: string) => {
    const key = `${productId}:${warehouseId}`;
    let acc = perCell.get(key);
    if (!acc) perCell.set(key, (acc = emptyAcc()));
    return acc;
  };
  const total = (productId: string) => {
    let acc = perTotal.get(productId);
    if (!acc) perTotal.set(productId, (acc = emptyAcc()));
    return acc;
  };

  const applyStock = (productId: string, warehouseId: string, delta: Prisma.Decimal, sellable: boolean) => {
    const t = total(productId);
    t.onHand = t.onHand.plus(delta);
    if (sellable) t.sellable = t.sellable.plus(delta);
    if (!warehouseIds.has(warehouseId)) {
      // inactive warehouse: total only, surfaced separately so the gap is explained
      inactiveOnHand.set(productId, (inactiveOnHand.get(productId) ?? zero()).plus(delta));
      return;
    }
    const c = cell(productId, warehouseId);
    c.onHand = c.onHand.plus(delta);
    if (sellable) c.sellable = c.sellable.plus(delta);
  };

  for (const movement of input.movements) {
    const productId = movement.batch.productId;
    const sellable = movement.batch.status === BatchStatus.AVAILABLE;
    if (movement.toWarehouseId) applyStock(productId, movement.toWarehouseId, movement.quantityKg, sellable);
    if (movement.fromWarehouseId) {
      applyStock(productId, movement.fromWarehouseId, movement.quantityKg.negated(), sellable);
    }
  }

  for (const reservation of input.reservations) {
    const { productId, quantityKg } = reservation;
    if (reservation.batchId !== null && reservation.batch?.status !== BatchStatus.AVAILABLE) {
      inconsistent.set(productId, (inconsistent.get(productId) ?? zero()).plus(quantityKg));
      continue;
    }
    const t = total(productId);
    t.reserved = t.reserved.plus(quantityKg);
    if (reservation.warehouseId === null) {
      unallocated.set(productId, (unallocated.get(productId) ?? zero()).plus(quantityKg));
    } else if (warehouseIds.has(reservation.warehouseId)) {
      const c = cell(productId, reservation.warehouseId);
      c.reserved = c.reserved.plus(quantityKg);
    }
  }

  return {
    warehouses: input.warehouses,
    rows: input.products.map((product) => ({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      byWarehouse: Object.fromEntries(
        input.warehouses.map((w) => [w.id, toCell(perCell.get(`${product.id}:${w.id}`) ?? emptyAcc())]),
      ),
      total: toCell(perTotal.get(product.id) ?? emptyAcc()),
      unallocatedReservedKg: decimalToString(unallocated.get(product.id) ?? zero()),
      inconsistentReservedKg: decimalToString(inconsistent.get(product.id) ?? zero()),
      inactiveWarehouseOnHandKg: decimalToString(inactiveOnHand.get(product.id) ?? zero()),
    })),
  };
}

/**
 * Per-product stock broken down by active warehouse, plus a company total
 * that equals getStockAvailability (physicalOnHandKg / availableKg) for
 * every product. Read-only, company-wide, no per-user scoping — the page
 * decides who may see it (inventory.stock.read), like every other
 * warehouse read service. Warehouses come from the database (active,
 * ordered by code), never a hardcoded list.
 */
export async function getStockByWarehouse(): Promise<StockByWarehouse> {
  const [products, warehouses, movements, reservations] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, sku: true, name: true },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
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
      where: { status: ReservationStatus.ACTIVE },
      select: {
        productId: true,
        warehouseId: true,
        batchId: true,
        quantityKg: true,
        batch: { select: { status: true } },
      },
    }),
  ]);

  return aggregateStockByWarehouse({ products, warehouses, movements, reservations });
}
