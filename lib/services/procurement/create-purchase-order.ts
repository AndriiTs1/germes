import { Prisma, PurchaseOrderStatus, SupplierStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { generatePurchaseOrderNumber } from "@/lib/services/procurement/generate-purchase-order-number";
import { isPurchaseOrderCurrency, type CreatePurchaseOrderInput } from "@/lib/validation/purchase-order";

/**
 * A DRAFT may be raised with an established supplier or one still being
 * onboarded. INACTIVE and BLOCKED suppliers are never eligible. Whether a
 * CONFIRMED order requires ACTIVE is a separate, still-open decision for
 * the status-transition service.
 */
const DRAFT_ELIGIBLE_SUPPLIER_STATUSES: SupplierStatus[] = [
  SupplierStatus.ACTIVE,
  SupplierStatus.POTENTIAL,
  SupplierStatus.IN_PROGRESS,
];

const MAX_ORDER_NUMBER_ATTEMPTS = 5;

const ORDER_NUMBER_UNIQUE_INDEX = "purchase_orders_orderNumber_key";
const ORDER_NUMBER_FIELD = "orderNumber";
const PURCHASE_ORDERS_TABLE = "purchase_orders";

export type CreatePurchaseOrderError =
  | "SUPPLIER_UNAVAILABLE"
  | "WAREHOUSE_UNAVAILABLE"
  | "PRODUCT_UNAVAILABLE"
  | "CREATE_FAILED";

export type CreatePurchaseOrderResult =
  | { ok: true; purchaseOrderId: string }
  | { ok: false; error: CreatePurchaseOrderError };

/** Thrown inside the transaction to trigger an automatic rollback; caught outside and translated to a safe, generic result — same pattern as createSalesOrder. */
class SupplierUnavailableError extends Error {}
class WarehouseUnavailableError extends Error {}
class ProductUnavailableError extends Error {}
class InvalidItemError extends Error {}

function parseExpectedArrivalDate(value: string | undefined): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Throws InvalidItemError instead of ever coercing: the Zod pass already guarantees this, but the write boundary never trusts that a caller validated correctly. */
function toPositiveDecimal(value: string): Prisma.Decimal {
  let decimal: Prisma.Decimal;
  try {
    decimal = new Prisma.Decimal(value);
  } catch {
    throw new InvalidItemError();
  }
  if (!decimal.isFinite() || !decimal.gt(0)) {
    throw new InvalidItemError();
  }
  return decimal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Postgres reports key columns quoted when their names are mixed-case ("orderNumber"). */
function unquoteIdentifier(value: string): string {
  return value.trim().replace(/^"(.*)"$/, "$1");
}

/**
 * Prisma 7 + @prisma/adapter-pg shape: the adapter's constraint is either
 * { index: <index name> } or, when Postgres gives no name, { fields }.
 * Only the exact orderNumber unique index, or exactly the single
 * orderNumber column, counts.
 */
function isOrderNumberConstraint(constraint: unknown): boolean {
  if (!isRecord(constraint)) return false;

  if (constraint.index === ORDER_NUMBER_UNIQUE_INDEX) return true;

  const fields = constraint.fields;
  return (
    Array.isArray(fields) &&
    fields.length === 1 &&
    typeof fields[0] === "string" &&
    unquoteIdentifier(fields[0]) === ORDER_NUMBER_FIELD
  );
}

/**
 * True only for a P2002 confidently attributed to PurchaseOrder.orderNumber —
 * never "any P2002", so a future unique constraint can't be mistaken for a
 * number collision and retried.
 *
 * With the current runtime Prisma puts the adapter error under
 * meta.driverAdapterError (meta.target is not populated — which is why
 * createSalesOrder's meta.target-only check never matches). meta.target is
 * kept as a narrow fallback for other runtimes.
 */
function isOrderNumberConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const meta: unknown = error.meta;
  if (!isRecord(meta)) return false;

  if (typeof meta.table === "string" && meta.table !== PURCHASE_ORDERS_TABLE) {
    return false;
  }

  const adapterError = meta.driverAdapterError;
  if (isRecord(adapterError) && isRecord(adapterError.cause)) {
    return isOrderNumberConstraint(adapterError.cause.constraint);
  }

  const target = meta.target;
  if (typeof target === "string") return target === ORDER_NUMBER_UNIQUE_INDEX;
  return Array.isArray(target) && target.length === 1 && target[0] === ORDER_NUMBER_FIELD;
}

/**
 * Creates one DRAFT PurchaseOrder with its items, atomically. A DRAFT is an
 * intention to buy — it never creates or changes Batch, StockMovement,
 * StockReservation, Payable, SupplierProduct or any stock figure. The only
 * tables written are purchase_orders, purchase_order_items and audit_logs.
 *
 * status (DRAFT), orderNumber, orderDate (null) and createdById
 * (currentUserId) are always set here, never taken from input. No
 * authorization happens here: the caller must independently
 * requirePermission("procurement.orders.create") and pass that user's id.
 *
 * Every attempt runs in its own fresh prisma.$transaction: supplier,
 * warehouse and product checks, number generation, the PurchaseOrder +
 * PurchaseOrderItem rows and the AuditLog entry all share one transaction
 * client, so any failure rolls back everything done in that attempt.
 *
 * Only a collision on the orderNumber unique index retries the WHOLE
 * transaction (up to MAX_ORDER_NUMBER_ATTEMPTS, with a freshly recomputed
 * number). Business errors and every other failure return immediately.
 */
export async function createPurchaseOrder(
  currentUserId: string,
  input: CreatePurchaseOrderInput,
): Promise<CreatePurchaseOrderResult> {
  // Zod already restricts this to PURCHASE_ORDER_CURRENCIES; the write
  // boundary re-checks it rather than trusting that a caller validated.
  if (!isPurchaseOrderCurrency(input.currency)) {
    return { ok: false, error: "CREATE_FAILED" };
  }

  const destinationWarehouseId = input.destinationWarehouseId ?? null;
  const expectedArrivalDate = parseExpectedArrivalDate(input.expectedArrivalDate);
  const notes = input.notes && input.notes.length > 0 ? input.notes : null;
  const year = new Date().getUTCFullYear();

  for (let attempt = 1; attempt <= MAX_ORDER_NUMBER_ATTEMPTS; attempt++) {
    try {
      const purchaseOrderId = await prisma.$transaction(async (tx) => {
        const supplier = await tx.supplier.findFirst({
          where: {
            id: input.supplierId,
            isActive: true,
            status: { in: DRAFT_ELIGIBLE_SUPPLIER_STATUSES },
          },
          select: { id: true },
        });

        if (!supplier) {
          throw new SupplierUnavailableError();
        }

        if (destinationWarehouseId !== null) {
          const warehouse = await tx.warehouse.findFirst({
            where: { id: destinationWarehouseId, isActive: true },
            select: { id: true },
          });

          if (!warehouse) {
            throw new WarehouseUnavailableError();
          }
        }

        const productIds = input.items.map((item) => item.productId);
        const uniqueProductIds = Array.from(new Set(productIds));

        // Zod already rejects this; a caller that bypassed it must not
        // produce an order with duplicate lines.
        if (uniqueProductIds.length !== productIds.length || productIds.length === 0) {
          throw new InvalidItemError();
        }

        const products = await tx.product.findMany({
          where: { id: { in: uniqueProductIds }, isActive: true },
          select: { id: true },
        });

        // Fewer rows means at least one id was nonexistent or inactive —
        // never reveals which one.
        if (products.length !== uniqueProductIds.length) {
          throw new ProductUnavailableError();
        }

        // Prepared before any row is written.
        const preparedItems = input.items.map((item) => ({
          productId: item.productId,
          quantityKg: toPositiveDecimal(item.quantityKg),
          pricePerKg: item.pricePerKg === undefined ? null : toPositiveDecimal(item.pricePerKg),
        }));

        const orderNumber = await generatePurchaseOrderNumber(tx, year);

        const order = await tx.purchaseOrder.create({
          data: {
            orderNumber,
            supplierId: supplier.id,
            destinationWarehouseId,
            createdById: currentUserId,
            status: PurchaseOrderStatus.DRAFT,
            currency: input.currency,
            orderDate: null,
            expectedArrivalDate,
            notes,
          },
        });

        await tx.purchaseOrderItem.createMany({
          data: preparedItems.map((item) => ({
            purchaseOrderId: order.id,
            ...item,
          })),
        });

        await tx.auditLog.create({
          data: {
            actorId: currentUserId,
            entityType: "PurchaseOrder",
            entityId: order.id,
            action: "CREATE",
            metadata: {
              orderNumber: order.orderNumber,
              supplierId: order.supplierId,
              destinationWarehouseId: order.destinationWarehouseId,
              currency: order.currency,
              itemCount: preparedItems.length,
            },
          },
        });

        return order.id;
      });

      return { ok: true, purchaseOrderId };
    } catch (error) {
      if (error instanceof SupplierUnavailableError) {
        return { ok: false, error: "SUPPLIER_UNAVAILABLE" };
      }
      if (error instanceof WarehouseUnavailableError) {
        return { ok: false, error: "WAREHOUSE_UNAVAILABLE" };
      }
      if (error instanceof ProductUnavailableError) {
        return { ok: false, error: "PRODUCT_UNAVAILABLE" };
      }
      if (error instanceof InvalidItemError) {
        return { ok: false, error: "CREATE_FAILED" };
      }
      if (isOrderNumberConflict(error) && attempt < MAX_ORDER_NUMBER_ATTEMPTS) {
        continue;
      }
      // Retries exhausted, or any other unexpected/DB error — never leak details.
      return { ok: false, error: "CREATE_FAILED" };
    }
  }

  return { ok: false, error: "CREATE_FAILED" };
}
