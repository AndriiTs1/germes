import { Prisma, SupplierStatus } from "@/lib/generated/prisma/client";

/**
 * A DRAFT may be created or edited with an established supplier or one
 * still being onboarded. INACTIVE and BLOCKED suppliers are never eligible.
 */
export const DRAFT_ELIGIBLE_SUPPLIER_STATUSES: SupplierStatus[] = [
  SupplierStatus.ACTIVE,
  SupplierStatus.POTENTIAL,
  SupplierStatus.IN_PROGRESS,
];

/**
 * CONFIRMED means the terms are agreed with the supplier and the order is a
 * binding purchase commitment — so only an active (isActive) supplier in
 * status ACTIVE qualifies. POTENTIAL/IN_PROGRESS remain fine for drafts.
 */
export const CONFIRM_ELIGIBLE_SUPPLIER_STATUSES: SupplierStatus[] = [SupplierStatus.ACTIVE];

export type PurchaseOrderRuleViolation =
  | "SUPPLIER_UNAVAILABLE"
  | "WAREHOUSE_UNAVAILABLE"
  | "PRODUCT_UNAVAILABLE"
  | "INVALID_ITEM";

/** Thrown inside a transaction to roll it back; callers translate `code` into their own result. */
export class PurchaseOrderRuleError extends Error {
  constructor(readonly code: PurchaseOrderRuleViolation) {
    super(code);
  }
}

/** Strict "YYYY-MM-DD" (already Zod-validated) → UTC midnight, same convention as Sales requestedDate. */
export function parseExpectedArrivalDate(value: string | undefined): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Re-validates, against the database, everything a purchase order points
 * at: an active supplier in one of `supplierStatuses` (the DRAFT rule by
 * default; CONFIRM passes the stricter list), an active destination
 * warehouse (when one is set) and active, non-duplicate products. Never
 * reveals which product failed.
 */
export async function assertPurchaseOrderReferences(
  tx: Prisma.TransactionClient,
  refs: { supplierId: string; destinationWarehouseId: string | null; productIds: string[] },
  supplierStatuses: SupplierStatus[] = DRAFT_ELIGIBLE_SUPPLIER_STATUSES,
): Promise<void> {
  const supplier = await tx.supplier.findFirst({
    where: { id: refs.supplierId, isActive: true, status: { in: supplierStatuses } },
    select: { id: true },
  });
  if (!supplier) throw new PurchaseOrderRuleError("SUPPLIER_UNAVAILABLE");

  if (refs.destinationWarehouseId !== null) {
    const warehouse = await tx.warehouse.findFirst({
      where: { id: refs.destinationWarehouseId, isActive: true },
      select: { id: true },
    });
    if (!warehouse) throw new PurchaseOrderRuleError("WAREHOUSE_UNAVAILABLE");
  }

  const uniqueProductIds = Array.from(new Set(refs.productIds));
  // Zod already rejects duplicates/empty lists; a caller that bypassed it
  // must not produce an order with duplicate or zero lines.
  if (uniqueProductIds.length !== refs.productIds.length || uniqueProductIds.length === 0) {
    throw new PurchaseOrderRuleError("INVALID_ITEM");
  }

  const products = await tx.product.findMany({
    where: { id: { in: uniqueProductIds }, isActive: true },
    select: { id: true },
  });
  if (products.length !== uniqueProductIds.length) throw new PurchaseOrderRuleError("PRODUCT_UNAVAILABLE");
}

/** Never coerces: the Zod pass guarantees this, but the write boundary re-checks. */
function toPositiveDecimal(value: string): Prisma.Decimal {
  let decimal: Prisma.Decimal;
  try {
    decimal = new Prisma.Decimal(value);
  } catch {
    throw new PurchaseOrderRuleError("INVALID_ITEM");
  }
  if (!decimal.isFinite() || !decimal.gt(0)) throw new PurchaseOrderRuleError("INVALID_ITEM");
  return decimal;
}

/** Item rows ready to write; pricePerKg stays optional (null) as in a DRAFT. */
export function preparePurchaseOrderItems(
  items: { productId: string; quantityKg: string; pricePerKg?: string }[],
): { productId: string; quantityKg: Prisma.Decimal; pricePerKg: Prisma.Decimal | null }[] {
  return items.map((item) => ({
    productId: item.productId,
    quantityKg: toPositiveDecimal(item.quantityKg),
    pricePerKg: item.pricePerKg === undefined ? null : toPositiveDecimal(item.pricePerKg),
  }));
}
