import { z } from "zod";

/**
 * Stable codes, not English text — the purchase-order form resolves each
 * one through the dictionary, same approach as ORDER_FORM_ERROR_CODES in
 * sales-order.ts.
 */
export const PURCHASE_ORDER_FORM_ERROR_CODES = [
  "selectSupplier",
  "invalidWarehouse",
  "invalidCurrency",
  "invalidDate",
  "notesTooLong",
  "itemsRequired",
  "selectProduct",
  "duplicateProduct",
  "invalidQuantity",
  "quantityPositive",
  "invalidPrice",
  "pricePositive",
] as const;
export type PurchaseOrderFormErrorCode = (typeof PURCHASE_ORDER_FORM_ERROR_CODES)[number];

/**
 * Same DB-bound decimal-string patterns as sales-order.ts (duplicated,
 * not imported — that file is left untouched): quantityKg is
 * Decimal(14,3), pricePerKg is Decimal(14,4). No sign, no exponent, no
 * thousands separators.
 */
const QUANTITY_KG_PATTERN = /^\d{1,11}(\.\d{1,3})?$/;
const PRICE_PER_KG_PATTERN = /^\d{1,10}(\.\d{1,4})?$/;

/**
 * The only currencies a purchase order may use today (business rule).
 * Exact ISO codes — no trimming or case folding, so "uah"/" EUR" are
 * rejected, not normalized. The DB column stays a plain String; this list
 * is the single source for the form options and for server validation.
 */
export const PURCHASE_ORDER_CURRENCIES = ["UAH", "EUR"] as const;
export type PurchaseOrderCurrency = (typeof PURCHASE_ORDER_CURRENCIES)[number];

export function isPurchaseOrderCurrency(value: string): value is PurchaseOrderCurrency {
  return (PURCHASE_ORDER_CURRENCIES as readonly string[]).includes(value);
}

const NOTES_MAX_LENGTH = 2000;

/** Lexical "> 0" check — keeps this file free of Decimal/Prisma so a Client Component can import it. */
function hasNonZeroDigit(value: string): boolean {
  return /[1-9]/.test(value);
}

/** Strict "YYYY-MM-DD" check that rejects rolled-over dates like "2026-02-30" — same as sales-order.ts. */
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

const uuidSchema = z.uuid();

const quantityKgSchema = z
  .string()
  .trim()
  .regex(QUANTITY_KG_PATTERN, "invalidQuantity" satisfies PurchaseOrderFormErrorCode)
  .refine(hasNonZeroDigit, "quantityPositive" satisfies PurchaseOrderFormErrorCode);

/**
 * Optional in a DRAFT: a purchase order may be drafted before the
 * supplier's final price is known. Requiring a price on every item is a
 * confirmation rule, enforced by the status-transition service against the
 * stored items — not here.
 */
const optionalPricePerKgSchema = z
  .string()
  .optional()
  .transform(emptyToUndefined)
  .refine((value) => value === undefined || PRICE_PER_KG_PATTERN.test(value), {
    message: "invalidPrice" satisfies PurchaseOrderFormErrorCode,
  })
  .refine((value) => value === undefined || hasNonZeroDigit(value), {
    message: "pricePositive" satisfies PurchaseOrderFormErrorCode,
  });

const purchaseOrderItemSchema = z.object({
  productId: z.uuid("selectProduct" satisfies PurchaseOrderFormErrorCode),
  quantityKg: quantityKgSchema,
  pricePerKg: optionalPricePerKgSchema,
});

/**
 * Server-authoritative shape for creating (and editing) a DRAFT
 * PurchaseOrder. Structural checks only — supplier/warehouse/product
 * existence and status are re-validated by the service. Deliberately has
 * no id, orderNumber, createdById, status, orderDate, createdAt or
 * updatedAt field: none of those are ever accepted from the client.
 */
export const createPurchaseOrderSchema = z
  .object({
    supplierId: z.uuid("selectSupplier" satisfies PurchaseOrderFormErrorCode),
    destinationWarehouseId: z
      .string()
      .optional()
      .transform(emptyToUndefined)
      .refine((value) => value === undefined || uuidSchema.safeParse(value).success, {
        message: "invalidWarehouse" satisfies PurchaseOrderFormErrorCode,
      }),
    // Form state starts as "" (nothing selected), so the input type stays
    // string; the output is exactly one of PURCHASE_ORDER_CURRENCIES.
    currency: z.string().pipe(z.enum(PURCHASE_ORDER_CURRENCIES, "invalidCurrency" satisfies PurchaseOrderFormErrorCode)),
    expectedArrivalDate: z
      .string()
      .optional()
      .transform(emptyToUndefined)
      .refine((value) => value === undefined || isValidCalendarDateString(value), {
        message: "invalidDate" satisfies PurchaseOrderFormErrorCode,
      }),
    notes: z
      .string()
      .optional()
      .transform(emptyToUndefined)
      .refine((value) => value === undefined || value.length <= NOTES_MAX_LENGTH, {
        message: "notesTooLong" satisfies PurchaseOrderFormErrorCode,
      }),
    items: z
      .array(purchaseOrderItemSchema)
      .min(1, "itemsRequired" satisfies PurchaseOrderFormErrorCode),
  })
  .superRefine((data, ctx) => {
    const productIds = data.items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "duplicateProduct" satisfies PurchaseOrderFormErrorCode,
      });
    }
  });

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type PurchaseOrderItemFormValues = z.input<typeof purchaseOrderItemSchema>;
export type CreatePurchaseOrderFormValues = z.input<typeof createPurchaseOrderSchema>;
