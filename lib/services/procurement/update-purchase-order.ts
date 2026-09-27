import { PurchaseOrderStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  assertPurchaseOrderReferences,
  parseExpectedArrivalDate,
  preparePurchaseOrderItems,
  PurchaseOrderRuleError,
} from "@/lib/services/procurement/purchase-order-rules";
import { isPurchaseOrderCurrency, type CreatePurchaseOrderInput } from "@/lib/validation/purchase-order";

/** Editing accepts exactly the create input — the same business fields, nothing more. */
export type UpdatePurchaseOrderInput = CreatePurchaseOrderInput;

export type UpdatePurchaseOrderError =
  | "ORDER_NOT_EDITABLE"
  | "STALE_EDIT"
  | "SUPPLIER_UNAVAILABLE"
  | "WAREHOUSE_UNAVAILABLE"
  | "PRODUCT_UNAVAILABLE"
  | "UPDATE_FAILED";

export type UpdatePurchaseOrderResult = { ok: true } | { ok: false; error: UpdatePurchaseOrderError };

class OrderNotEditableError extends Error {}
class StaleEditError extends Error {}

/**
 * Edits one DRAFT PurchaseOrder's business fields (supplier, destination
 * warehouse, currency, expected arrival, notes) and wholesale-replaces its
 * items, atomically. id, orderNumber, status, createdById, createdAt and
 * orderDate are never read from input and never written here.
 *
 * Only a DRAFT is editable. The real guard is one atomic updateMany whose
 * WHERE re-asserts id + status:DRAFT + updatedAt:loadedUpdatedAt — so a
 * concurrent confirm/cancel/edit since the form was loaded makes it match
 * nothing and the edit is rejected, never silently overwriting. The
 * earlier findUnique only fails fast and tells the two cases apart.
 * Supplier/warehouse/product rules are re-checked, and items are only
 * touched after every guard has passed.
 *
 * No authorization here: the caller must requirePermission
 * ("procurement.orders.update") and pass that user's id.
 */
export async function updatePurchaseOrder(
  currentUserId: string,
  purchaseOrderId: string,
  loadedUpdatedAt: string,
  input: UpdatePurchaseOrderInput,
): Promise<UpdatePurchaseOrderResult> {
  if (!isPurchaseOrderCurrency(input.currency)) {
    return { ok: false, error: "UPDATE_FAILED" };
  }

  const loadedUpdatedAtDate = new Date(loadedUpdatedAt);
  if (Number.isNaN(loadedUpdatedAtDate.getTime())) {
    return { ok: false, error: "STALE_EDIT" };
  }

  const destinationWarehouseId = input.destinationWarehouseId ?? null;
  const expectedArrivalDate = parseExpectedArrivalDate(input.expectedArrivalDate);
  const notes = input.notes && input.notes.length > 0 ? input.notes : null;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        select: { status: true, updatedAt: true, orderNumber: true },
      });

      if (!existing || existing.status !== PurchaseOrderStatus.DRAFT) {
        throw new OrderNotEditableError();
      }
      if (existing.updatedAt.getTime() !== loadedUpdatedAtDate.getTime()) {
        throw new StaleEditError();
      }

      await assertPurchaseOrderReferences(tx, {
        supplierId: input.supplierId,
        destinationWarehouseId,
        productIds: input.items.map((item) => item.productId),
      });

      const preparedItems = preparePurchaseOrderItems(input.items);

      const updated = await tx.purchaseOrder.updateMany({
        where: { id: purchaseOrderId, status: PurchaseOrderStatus.DRAFT, updatedAt: loadedUpdatedAtDate },
        data: {
          supplierId: input.supplierId,
          destinationWarehouseId,
          currency: input.currency,
          expectedArrivalDate,
          notes,
        },
      });

      if (updated.count !== 1) {
        const stillDraft = await tx.purchaseOrder.findFirst({
          where: { id: purchaseOrderId, status: PurchaseOrderStatus.DRAFT },
          select: { id: true },
        });
        throw stillDraft ? new StaleEditError() : new OrderNotEditableError();
      }

      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId } });
      await tx.purchaseOrderItem.createMany({
        data: preparedItems.map((item) => ({ ...item, purchaseOrderId })),
      });

      await tx.auditLog.create({
        data: {
          actorId: currentUserId,
          entityType: "PurchaseOrder",
          entityId: purchaseOrderId,
          action: "UPDATE",
          metadata: {
            orderNumber: existing.orderNumber,
            supplierId: input.supplierId,
            destinationWarehouseId,
            currency: input.currency,
            itemCount: preparedItems.length,
          },
        },
      });
    });

    return { ok: true };
  } catch (error) {
    if (error instanceof OrderNotEditableError) return { ok: false, error: "ORDER_NOT_EDITABLE" };
    if (error instanceof StaleEditError) return { ok: false, error: "STALE_EDIT" };
    if (error instanceof PurchaseOrderRuleError) {
      return { ok: false, error: error.code === "INVALID_ITEM" ? "UPDATE_FAILED" : error.code };
    }
    // Never leak details of any other unexpected/DB error.
    return { ok: false, error: "UPDATE_FAILED" };
  }
}
