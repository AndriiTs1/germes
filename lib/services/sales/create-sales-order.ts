import { CustomerStatus, Prisma, SalesOrderStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { generateOrderNumber } from "@/lib/services/sales/generate-order-number";

const ELIGIBLE_CUSTOMER_STATUSES: CustomerStatus[] = [
  CustomerStatus.ACTIVE,
  CustomerStatus.POTENTIAL,
];

/** V1: fixed, never accepted from the client — see the schema-decision history in the Stage 8D.6 report. */
const ORDER_CURRENCY = "UAH";

const MAX_ORDER_NUMBER_ATTEMPTS = 5;

export type CreateSalesOrderItemInput = {
  productId: string;
  /** Already Zod-validated decimal string (Decimal(14,3) bounds, strictly > 0). */
  quantityKg: string;
  /** Already Zod-validated decimal string (Decimal(14,4) bounds, strictly > 0). */
  pricePerKg: string;
};

export type CreateSalesOrderInput = {
  customerId: string;
  /** "YYYY-MM-DD", already Zod-validated as a real calendar date. */
  requestedDate?: string;
  notes?: string;
  items: CreateSalesOrderItemInput[];
};

export type CreateSalesOrderError = "CUSTOMER_UNAVAILABLE" | "PRODUCT_UNAVAILABLE" | "CREATE_FAILED";

export type CreateSalesOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; error: CreateSalesOrderError };

/** Thrown inside the transaction to trigger an automatic rollback; caught outside and translated to a safe, generic result. */
class CustomerUnavailableError extends Error {}
class ProductUnavailableError extends Error {}
class InvalidItemError extends Error {}

function parseRequestedDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isOrderNumberConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.includes("orderNumber");
  if (typeof target === "string") return target.includes("orderNumber");
  return false;
}

/**
 * Creates one DRAFT SalesOrder with its items, atomically. No
 * StockReservation, no Receivable — both are explicitly out of scope for
 * this stage (see the Stage 8D.6 architecture decisions).
 *
 * Every write attempt (including order-number retries) runs inside its
 * own fresh prisma.$transaction: customer scope, product availability,
 * order-number generation, the SalesOrder + SalesOrderItem rows, and the
 * AuditLog entry are all validated/created through the same transaction
 * client, so a failure at any point rolls back everything already done in
 * that attempt — never a partial order, never an order with zero items.
 *
 * If SalesOrder.orderNumber's unique constraint is hit (a genuine
 * concurrent collision — see generateOrderNumber's doc comment), the
 * WHOLE transaction is retried from scratch, up to MAX_ORDER_NUMBER_ATTEMPTS
 * times, with a freshly recomputed candidate each time. Any other error
 * (validation, unexpected DB failure, a different unique constraint) is
 * never retried.
 */
export async function createSalesOrder(
  currentUserId: string,
  input: CreateSalesOrderInput,
): Promise<CreateSalesOrderResult> {
  const requestedDate = parseRequestedDate(input.requestedDate);
  const notes = input.notes && input.notes.length > 0 ? input.notes : null;
  const year = new Date().getUTCFullYear();

  for (let attempt = 1; attempt <= MAX_ORDER_NUMBER_ATTEMPTS; attempt++) {
    try {
      const orderId = await prisma.$transaction(async (tx) => {
        // Re-validated here (not trusted from the caller) — the exact
        // same scope as getSalesCustomerDetail, plus the two eligible
        // statuses. Foreign, nonexistent, inactive, or wrong-status
        // customers are all indistinguishable: one null, one error.
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

        // The returned set must exactly equal the submitted set — fewer
        // rows means at least one submitted id was nonexistent or
        // inactive. Never reveals which one.
        if (products.length !== uniqueProductIds.length) {
          throw new ProductUnavailableError();
        }

        const orderNumber = await generateOrderNumber(tx, year);

        const order = await tx.salesOrder.create({
          data: {
            orderNumber,
            customerId: customer.id,
            responsibleId: currentUserId,
            status: SalesOrderStatus.DRAFT,
            requestedDate,
            currency: ORDER_CURRENCY,
            notes,
          },
        });

        const itemsData = input.items.map((item) => {
          const quantityKg = new Prisma.Decimal(item.quantityKg);
          const pricePerKg = new Prisma.Decimal(item.pricePerKg);

          // Defense in depth: the action's Zod pass already guarantees
          // this, but the write boundary itself never trusts that a
          // caller validated correctly.
          if (!quantityKg.gt(0) || !pricePerKg.gt(0)) {
            throw new InvalidItemError();
          }

          return {
            salesOrderId: order.id,
            productId: item.productId,
            quantityKg,
            pricePerKg,
          };
        });

        await tx.salesOrderItem.createMany({ data: itemsData });

        await tx.auditLog.create({
          data: {
            actorId: currentUserId,
            entityType: "SalesOrder",
            entityId: order.id,
            action: "CREATE",
            metadata: {
              orderNumber: order.orderNumber,
              customerId: order.customerId,
              itemCount: itemsData.length,
              currency: order.currency,
            },
          },
        });

        return order.id;
      });

      return { ok: true, orderId };
    } catch (error) {
      if (error instanceof CustomerUnavailableError) {
        return { ok: false, error: "CUSTOMER_UNAVAILABLE" };
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
