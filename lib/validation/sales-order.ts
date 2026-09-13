import { z } from "zod";

/**
 * Decimal-string patterns bound to the exact DB precision/scale so an
 * out-of-range value is rejected before it ever reaches Prisma.Decimal:
 * quantityKg is Decimal(14,3) (up to 11 integer digits, 3 decimal),
 * pricePerKg is Decimal(14,4) (up to 10 integer digits, 4 decimal). No
 * sign, no exponent, no thousands separators — exactly what a plain
 * numeric HTML input can produce.
 */
const QUANTITY_KG_PATTERN = /^\d{1,11}(\.\d{1,3})?$/;
const PRICE_PER_KG_PATTERN = /^\d{1,10}(\.\d{1,4})?$/;

/**
 * "Strictly greater than zero" checked lexically (any nonzero digit
 * anywhere means the value is > 0) rather than via Number()/parseFloat()
 * or a Decimal library — this file must stay safe to import from a
 * Client Component, and the check needs no arithmetic at all.
 */
function hasNonZeroDigit(value: string): boolean {
  return /[1-9]/.test(value);
}

const quantityKgSchema = z
  .string()
  .trim()
  .regex(QUANTITY_KG_PATTERN, "Enter a valid quantity (up to 3 decimal places)")
  .refine(hasNonZeroDigit, "Quantity must be greater than 0");

const pricePerKgSchema = z
  .string()
  .trim()
  .regex(PRICE_PER_KG_PATTERN, "Enter a valid price (up to 4 decimal places)")
  .refine(hasNonZeroDigit, "Price must be greater than 0");

const orderItemSchema = z.object({
  productId: z.uuid("Select a product"),
  quantityKg: quantityKgSchema,
  pricePerKg: pricePerKgSchema,
});

/**
 * Strict calendar-date check for a "YYYY-MM-DD" string (the native shape
 * of an HTML date input). Deliberately does NOT just do
 * `!isNaN(new Date(value))` — JS silently rolls an impossible date like
 * "2026-02-30" forward into a valid one (March 2nd), which would store a
 * date the user never actually entered. Constructing the date and
 * reading back its UTC fields catches that rollover.
 */
function isValidCalendarDateString(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Server-authoritative shape for creating a SalesOrder. Deliberately has
 * no `status`, `responsibleId`, `orderNumber`, `total`, or `currency`
 * field — none of those are ever accepted from the client; the service
 * layer sets them itself (see create-sales-order.ts).
 */
export const createSalesOrderSchema = z
  .object({
    customerId: z.uuid("Select a customer"),
    requestedDate: z
      .string()
      .optional()
      .transform(emptyToUndefined)
      .refine((value) => value === undefined || isValidCalendarDateString(value), {
        message: "Enter a valid date",
      }),
    notes: z
      .string()
      .optional()
      .transform(emptyToUndefined)
      .refine((value) => value === undefined || value.length <= 2000, {
        message: "Notes must be 2000 characters or fewer",
      }),
    items: z.array(orderItemSchema).min(1, "Add at least one item"),
  })
  .superRefine((data, ctx) => {
    const productIds = data.items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "Each product can only appear once in an order",
      });
    }
  });

export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;
export type CreateSalesOrderItemFormValues = z.input<typeof orderItemSchema>;
export type CreateSalesOrderFormValues = z.input<typeof createSalesOrderSchema>;
