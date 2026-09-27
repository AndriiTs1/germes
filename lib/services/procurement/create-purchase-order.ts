import { Prisma, PurchaseOrderStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { generatePurchaseOrderNumber } from "@/lib/services/procurement/generate-purchase-order-number";
import {
  assertPurchaseOrderReferences,
  parseExpectedArrivalDate,
  preparePurchaseOrderItems,
  PurchaseOrderRuleError,
} from "@/lib/services/procurement/purchase-order-rules";
import { isPurchaseOrderCurrency, type CreatePurchaseOrderInput } from "@/lib/validation/purchase-order";

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
        await assertPurchaseOrderReferences(tx, {
          supplierId: input.supplierId,
          destinationWarehouseId,
          productIds: input.items.map((item) => item.productId),
        });

        // Prepared before any row is written.
        const preparedItems = preparePurchaseOrderItems(input.items);

        const orderNumber = await generatePurchaseOrderNumber(tx, year);

        const order = await tx.purchaseOrder.create({
          data: {
            orderNumber,
            supplierId: input.supplierId,
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
      if (error instanceof PurchaseOrderRuleError) {
        return { ok: false, error: error.code === "INVALID_ITEM" ? "CREATE_FAILED" : error.code };
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
