import { CustomerStatus, Prisma, SalesOrderStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CreateSalesOrderInput } from "@/lib/services/sales/create-sales-order";

/**
 * Intentionally duplicated from create-sales-order.ts (not imported/
 * exported) rather than modifying that file just to share a two-value
 * constant — this stage's scope is create-only-new-files.
 */
const ELIGIBLE_CUSTOMER_STATUSES: CustomerStatus[] = [
  CustomerStatus.ACTIVE,
  CustomerStatus.POTENTIAL,
];

/** Reuses createSalesOrder's exact input shape — editing validates/accepts the same fields as creating (customerId, requestedDate?, notes?, items[]). No new field, none removed. */
export type UpdateSalesOrderInput = CreateSalesOrderInput;

export type UpdateSalesOrderError =
  | "ORDER_NOT_EDITABLE"
  | "STALE_EDIT"
  | "CUSTOMER_UNAVAILABLE"
  | "PRODUCT_UNAVAILABLE"
  | "UPDATE_FAILED";

export type UpdateSalesOrderResult =
  | { ok: true; previousCustomerId: string }
  | { ok: false; error: UpdateSalesOrderError };

/** Thrown inside the transaction to trigger an automatic rollback; caught outside and translated to a safe, generic result — same pattern as createSalesOrder. */
class OrderNotEditableError extends Error {}
class StaleEditError extends Error {}
class CustomerUnavailableError extends Error {}
class ProductUnavailableError extends Error {}
class InvalidItemError extends Error {}

function parseRequestedDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Updates one DRAFT SalesOrder's editable fields (customerId,
 * requestedDate, notes) and wholesale-replaces its items, atomically.
 * orderNumber, responsibleId, status, and currency are never accepted
 * from input and are never touched by this function — currency in
 * particular stays exactly what the order already has (itself always
 * "UAH" today per createSalesOrder's V1 decision); it is never read from
 * `input` at all, only ever carried forward implicitly by not being
 * included in the update's `data`.
 *
 * Concurrency: `loadedUpdatedAt` must be the order's own updatedAt value
 * as it was when the edit form was loaded. The actual write is gated by
 * one atomic `updateMany` whose WHERE re-asserts
 * id + responsibleId + status:DRAFT + updatedAt:loadedUpdatedAt together —
 * this (not any earlier read) is the real race-proof guard, since Postgres
 * evaluates an UPDATE statement's WHERE and its write as one atomic
 * operation. An earlier findFirst is done first purely to fail fast and to
 * distinguish *why* a later mismatch occurred (see below), never as the
 * actual safety mechanism.
 *
 * Ordering is deliberate: customer/product revalidation and the
 * concurrency-guarded scalar update both happen BEFORE any
 * SalesOrderItem is deleted. If the order isn't editable, is stale, or
 * references an unavailable customer/product, the transaction throws and
 * rolls back before touching a single item row — a rejected update never
 * destroys existing items.
 *
 * On success, also returns the order's customerId as it was BEFORE this
 * update (from the fail-fast read already done above — no extra query),
 * so the caller can revalidate the old customer's pages when the customer
 * was changed. Same reasoning as transitionSalesOrderStatus's customerId.
 */
export async function updateSalesOrder(
  currentUserId: string,
  orderId: string,
  loadedUpdatedAt: string,
  input: UpdateSalesOrderInput,
): Promise<UpdateSalesOrderResult> {
  const requestedDate = parseRequestedDate(input.requestedDate);
  const notes = input.notes && input.notes.length > 0 ? input.notes : null;
  const loadedUpdatedAtDate = new Date(loadedUpdatedAt);

  try {
    const previousCustomerId = await prisma.$transaction(async (tx) => {
      // Fail-fast pre-check (not the safety guard itself — see doc comment above).
      const existing = await tx.salesOrder.findFirst({
        where: { id: orderId, responsibleId: currentUserId, status: SalesOrderStatus.DRAFT },
        select: { updatedAt: true, orderNumber: true, customerId: true },
      });

      if (!existing) {
        throw new OrderNotEditableError();
      }
      if (existing.updatedAt.getTime() !== loadedUpdatedAtDate.getTime()) {
        throw new StaleEditError();
      }

      // Re-validated here (not trusted from the caller) — identical scope to createSalesOrder.
      const customer = await tx.customer.findFirst({
        where: {
          id: input.customerId,
          responsibleId: currentUserId,
          isActive: true,
          status: { in: ELIGIBLE_CUSTOMER_STATUSES },
        },
        select: { id: true },
      });

      if (!customer) {
        throw new CustomerUnavailableError();
      }

      const uniqueProductIds = Array.from(new Set(input.items.map((item) => item.productId)));

      const products = await tx.product.findMany({
        where: { id: { in: uniqueProductIds }, isActive: true },
        select: { id: true },
      });

      if (products.length !== uniqueProductIds.length) {
        throw new ProductUnavailableError();
      }

      const itemsData = input.items.map((item) => {
        const quantityKg = new Prisma.Decimal(item.quantityKg);
        const pricePerKg = new Prisma.Decimal(item.pricePerKg);

        // Defense in depth — the action's Zod pass already guarantees this.
        if (!quantityKg.gt(0) || !pricePerKg.gt(0)) {
          throw new InvalidItemError();
        }

        return { productId: item.productId, quantityKg, pricePerKg };
      });

      // THE actual atomic guard: id + responsibleId + status + updatedAt
      // are all re-asserted together in one UPDATE statement. If anything
      // changed since the fail-fast read above (a genuine race), count
      // will be 0 here even though the read just above passed.
      const updateResult = await tx.salesOrder.updateMany({
        where: {
          id: orderId,
          responsibleId: currentUserId,
          status: SalesOrderStatus.DRAFT,
          updatedAt: loadedUpdatedAtDate,
        },
        data: {
          customerId: customer.id,
          requestedDate,
          notes,
        },
      });

      if (updateResult.count !== 1) {
        // Distinguish "no longer exists/owned/DRAFT" from "still is, but
        // changed since load" — a read-only diagnostic, safe to run here
        // since no item has been touched yet either way.
        const stillEditable = await tx.salesOrder.findFirst({
          where: { id: orderId, responsibleId: currentUserId, status: SalesOrderStatus.DRAFT },
          select: { id: true },
        });
        throw stillEditable ? new StaleEditError() : new OrderNotEditableError();
      }

      // Only now, after every guard has passed, are items touched.
      await tx.salesOrderItem.deleteMany({ where: { salesOrderId: orderId } });
      await tx.salesOrderItem.createMany({
        data: itemsData.map((item) => ({ ...item, salesOrderId: orderId })),
      });

      await tx.auditLog.create({
        data: {
          actorId: currentUserId,
          entityType: "SalesOrder",
          entityId: orderId,
          action: "UPDATE",
          metadata: {
            orderNumber: existing.orderNumber,
            customerId: customer.id,
            itemCount: itemsData.length,
          },
        },
      });

      return existing.customerId;
    });

    return { ok: true, previousCustomerId };
  } catch (error) {
    if (error instanceof OrderNotEditableError) return { ok: false, error: "ORDER_NOT_EDITABLE" };
    if (error instanceof StaleEditError) return { ok: false, error: "STALE_EDIT" };
    if (error instanceof CustomerUnavailableError) return { ok: false, error: "CUSTOMER_UNAVAILABLE" };
    if (error instanceof ProductUnavailableError) return { ok: false, error: "PRODUCT_UNAVAILABLE" };
    if (error instanceof InvalidItemError) return { ok: false, error: "UPDATE_FAILED" };
    // Never leak details of any other unexpected/DB error.
    return { ok: false, error: "UPDATE_FAILED" };
  }
}
