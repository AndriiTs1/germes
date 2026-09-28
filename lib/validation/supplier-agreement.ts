import { z } from "zod";

import {
  Incoterm,
  PaymentDueBasis,
  SupplierAgreementStatus,
} from "@/lib/generated/prisma/enums";

/**
 * Stable codes, not English text — a future agreement form resolves each
 * one through the dictionary, same approach as
 * PURCHASE_ORDER_FORM_ERROR_CODES.
 */
export const SUPPLIER_AGREEMENT_ERROR_CODES = [
  "agreementNumberRequired",
  "agreementNumberTooLong",
  "invalidCurrency",
  "invalidDate",
  "validToBeforeValidFrom",
  "invalidPrepaymentPercent",
  "balanceNotAllowed",
  "balanceDueDaysRequired",
  "balanceDueBasisRequired",
  "invalidDays",
  "paymentTermsNoteTooLong",
  "incotermVersionRequired",
  "unsupportedIncotermVersion",
  "incotermPlaceRequired",
  "incotermPlaceTooLong",
  "incotermDetailsWithoutCode",
  "notesTooLong",
  "selectProduct",
  "invalidQuantity",
  "invalidPrice",
  "pricePositive",
  "duplicateTier",
  "invalidIncoterm",
  "invalidBalanceDueBasis",
  "invalidPaymentTermsMode",
] as const;
export type SupplierAgreementErrorCode = (typeof SUPPLIER_AGREEMENT_ERROR_CODES)[number];

/**
 * Same business rule as PURCHASE_ORDER_CURRENCIES (not imported, so the
 * purchase-order module stays untouched): exact ISO codes, no trimming or
 * case folding. The DB column is a plain String.
 */
export const SUPPLIER_AGREEMENT_CURRENCIES = ["UAH", "EUR"] as const;
export type SupplierAgreementCurrency = (typeof SUPPLIER_AGREEMENT_CURRENCIES)[number];

/** The only Incoterms edition supported; stored per agreement so a later edition never reinterprets old ones. */
export const SUPPORTED_INCOTERM_VERSION = 2020;

/**
 * Commercial data (currency, validity, payment terms, Incoterm, items and
 * price tiers) may only change while an agreement is a DRAFT. ACTIVE terms
 * are fixed — a change is a new agreement/amendment; CLOSED is terminal.
 */
export const COMMERCIALLY_EDITABLE_AGREEMENT_STATUSES: readonly SupplierAgreementStatus[] = [
  SupplierAgreementStatus.DRAFT,
];

export function isAgreementCommerciallyEditable(status: SupplierAgreementStatus): boolean {
  return COMMERCIALLY_EDITABLE_AGREEMENT_STATUSES.includes(status);
}

const AGREEMENT_NUMBER_MAX_LENGTH = 100;
const INCOTERM_PLACE_MAX_LENGTH = 200;
const NOTES_MAX_LENGTH = 2000;

/**
 * Same DB-bound decimal-string patterns as purchase-order.ts:
 * minQuantityKg is Decimal(14,3), pricePerKg is Decimal(14,4). No sign,
 * no exponent, no thousands separators — so a negative value can't pass.
 */
const QUANTITY_KG_PATTERN = /^\d{1,11}(\.\d{1,3})?$/;
const PRICE_PER_KG_PATTERN = /^\d{1,10}(\.\d{1,4})?$/;

/** Lexical "> 0" check — keeps this file free of Decimal/Prisma runtime. */
function hasNonZeroDigit(value: string): boolean {
  return /[1-9]/.test(value);
}

/**
 * Strict "YYYY-MM-DD" check that rejects rolled-over dates like
 * "2026-02-30". Dates stay strings here (stored later as UTC midnight), so
 * validation never depends on the clock or the runtime timezone.
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

/** Blank/whitespace-only optional text is "not set". */
function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const dateSchema = z.string().refine(isValidCalendarDateString, {
  message: "invalidDate" satisfies SupplierAgreementErrorCode,
});

const nonNegativeDaysSchema = z
  .number()
  .int("invalidDays" satisfies SupplierAgreementErrorCode)
  .min(0, "invalidDays" satisfies SupplierAgreementErrorCode);

function optionalText(maxLength: number, tooLong: SupplierAgreementErrorCode) {
  return z
    .string()
    .nullish()
    .transform(emptyToNull)
    .refine((value) => value === null || value.length <= maxLength, { message: tooLong });
}

/**
 * Server-authoritative shape of an agreement's own commercial terms.
 * Structural and cross-field invariants only — supplier existence, status
 * transitions and uniqueness of agreementNumber per supplier belong to
 * the (future) service. Deliberately has no id, supplierId, status,
 * createdById or timestamps: none of those are accepted from a client.
 *
 * Invariants:
 * - validTo is null (open-ended) or >= validFrom; one-day agreements are fine.
 * - Payment terms are either not structured at all (all three null; a
 *   note may still describe them), 100% prepayment (no balance), or
 *   0–99% prepayment with a balance due N >= 0 days after a basis date.
 * - No Incoterm ⇒ no version/place; an Incoterm ⇒ version 2020 and a
 *   non-empty named place (code and place are never one string).
 */
export const supplierAgreementTermsSchema = z
  .object({
    agreementNumber: z
      .string()
      .trim()
      .min(1, "agreementNumberRequired" satisfies SupplierAgreementErrorCode)
      .max(AGREEMENT_NUMBER_MAX_LENGTH, "agreementNumberTooLong" satisfies SupplierAgreementErrorCode),
    validFrom: dateSchema,
    validTo: dateSchema.nullable(),
    currency: z
      .string()
      .pipe(z.enum(SUPPLIER_AGREEMENT_CURRENCIES, "invalidCurrency" satisfies SupplierAgreementErrorCode)),
    prepaymentPercent: z
      .number()
      .int("invalidPrepaymentPercent" satisfies SupplierAgreementErrorCode)
      .min(0, "invalidPrepaymentPercent" satisfies SupplierAgreementErrorCode)
      .max(100, "invalidPrepaymentPercent" satisfies SupplierAgreementErrorCode)
      .nullable(),
    balanceDueDays: nonNegativeDaysSchema.nullable(),
    balanceDueBasis: z.enum(PaymentDueBasis).nullable(),
    paymentTermsNote: optionalText(NOTES_MAX_LENGTH, "paymentTermsNoteTooLong"),
    incoterm: z.enum(Incoterm).nullable(),
    incotermVersion: z.number().int().nullable(),
    incotermPlace: optionalText(INCOTERM_PLACE_MAX_LENGTH, "incotermPlaceTooLong"),
    defaultLeadTimeDays: nonNegativeDaysSchema.nullable(),
    notes: optionalText(NOTES_MAX_LENGTH, "notesTooLong"),
  })
  .superRefine((data, ctx) => {
    // Both are strict YYYY-MM-DD, so string order is calendar order.
    if (data.validTo !== null && data.validTo < data.validFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["validTo"],
        message: "validToBeforeValidFrom" satisfies SupplierAgreementErrorCode,
      });
    }

    const { prepaymentPercent, balanceDueDays, balanceDueBasis } = data;
    if (prepaymentPercent === null || prepaymentPercent === 100) {
      // Not structured, or 100% prepayment: there is no balance to schedule.
      if (balanceDueDays !== null || balanceDueBasis !== null) {
        ctx.addIssue({
          code: "custom",
          path: [balanceDueDays !== null ? "balanceDueDays" : "balanceDueBasis"],
          message: "balanceNotAllowed" satisfies SupplierAgreementErrorCode,
        });
      }
    } else {
      if (balanceDueDays === null) {
        ctx.addIssue({
          code: "custom",
          path: ["balanceDueDays"],
          message: "balanceDueDaysRequired" satisfies SupplierAgreementErrorCode,
        });
      }
      if (balanceDueBasis === null) {
        ctx.addIssue({
          code: "custom",
          path: ["balanceDueBasis"],
          message: "balanceDueBasisRequired" satisfies SupplierAgreementErrorCode,
        });
      }
    }

    if (data.incoterm === null) {
      if (data.incotermVersion !== null || data.incotermPlace !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["incoterm"],
          message: "incotermDetailsWithoutCode" satisfies SupplierAgreementErrorCode,
        });
      }
    } else {
      if (data.incotermVersion === null) {
        ctx.addIssue({
          code: "custom",
          path: ["incotermVersion"],
          message: "incotermVersionRequired" satisfies SupplierAgreementErrorCode,
        });
      } else if (data.incotermVersion !== SUPPORTED_INCOTERM_VERSION) {
        ctx.addIssue({
          code: "custom",
          path: ["incotermVersion"],
          message: "unsupportedIncotermVersion" satisfies SupplierAgreementErrorCode,
        });
      }
      if (data.incotermPlace === null) {
        ctx.addIssue({
          code: "custom",
          path: ["incotermPlace"],
          message: "incotermPlaceRequired" satisfies SupplierAgreementErrorCode,
        });
      }
    }
  });

/**
 * One quantity tier of an agreement item's price. minQuantityKg may be 0:
 * that is the base tier, applying to any positive ordered quantity.
 */
export const supplierAgreementPriceTierSchema = z.object({
  minQuantityKg: z
    .string()
    .trim()
    .regex(QUANTITY_KG_PATTERN, "invalidQuantity" satisfies SupplierAgreementErrorCode),
  pricePerKg: z
    .string()
    .trim()
    .regex(PRICE_PER_KG_PATTERN, "invalidPrice" satisfies SupplierAgreementErrorCode)
    .refine(hasNonZeroDigit, "pricePositive" satisfies SupplierAgreementErrorCode),
});

/**
 * One product within an agreement with its price tiers. Mirrors the
 * @@unique([agreementItemId, minQuantityKg]) constraint: two tiers may not
 * share a threshold ("1000" and "1000.0" are the same threshold). Whether
 * an item needs at least one tier is an activation rule, not checked here.
 */
export const supplierAgreementItemSchema = z
  .object({
    productId: z.uuid("selectProduct" satisfies SupplierAgreementErrorCode),
    leadTimeDays: nonNegativeDaysSchema.nullable(),
    priceTiers: z.array(supplierAgreementPriceTierSchema),
  })
  .superRefine((data, ctx) => {
    // Decimal(14,3) thresholds are exact in a double, so Number() compares them safely.
    const thresholds = data.priceTiers.map((tier) => Number(tier.minQuantityKg));
    if (new Set(thresholds).size !== thresholds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["priceTiers"],
        message: "duplicateTier" satisfies SupplierAgreementErrorCode,
      });
    }
  });

export type SupplierAgreementTermsInput = z.infer<typeof supplierAgreementTermsSchema>;
export type SupplierAgreementItemInput = z.infer<typeof supplierAgreementItemSchema>;
export type SupplierAgreementPriceTierInput = z.infer<typeof supplierAgreementPriceTierSchema>;

/**
 * How the create form expresses payment terms: "none" (no structured
 * terms — a note may still describe them) or "structured".
 */
export const PAYMENT_TERMS_MODES = ["none", "structured"] as const;
export type PaymentTermsMode = (typeof PAYMENT_TERMS_MODES)[number];

/** Whole non-negative day counts / percents as typed into a text field (no sign, no decimals). */
const DAYS_PATTERN = /^\d{1,5}$/;
const PERCENT_PATTERN = /^\d{1,3}$/;

function intOrNull(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
}

/**
 * Raw create-form values: every field is a string (or the payment-terms
 * mode), exactly as the form holds them. Only these keys are read — any
 * other key a client sends (status, supplierId, createdById,
 * incotermVersion…) is stripped by z.object and never reaches the service.
 */
const supplierAgreementFormObject = z.object({
  agreementNumber: z.string(),
  validFrom: z.string(),
  validTo: z.string(),
  currency: z.string(),
  paymentTermsMode: z.enum(PAYMENT_TERMS_MODES, "invalidPaymentTermsMode" satisfies SupplierAgreementErrorCode),
  prepaymentPercent: z.string(),
  balanceDueDays: z.string(),
  balanceDueBasis: z.union([z.literal(""), z.enum(PaymentDueBasis)], {
    error: "invalidBalanceDueBasis" satisfies SupplierAgreementErrorCode,
  }),
  paymentTermsNote: z.string(),
  incoterm: z.union([z.literal(""), z.enum(Incoterm)], {
    error: "invalidIncoterm" satisfies SupplierAgreementErrorCode,
  }),
  incotermPlace: z.string(),
  defaultLeadTimeDays: z.string(),
  notes: z.string(),
});

/**
 * Create-form parser: checks the text formats, then maps the form onto
 * the agreement's terms and runs supplierAgreementTermsSchema — the one
 * source of the business invariants. The mapping is where the controlling
 * choices win over stale inputs:
 * - mode "none" ⇒ no structured payment terms (the note is kept);
 * - 100% prepayment ⇒ no balance days/basis, whatever was typed before;
 * - no Incoterm ⇒ no version/place; an Incoterm ⇒ version is always the
 *   supported one (server-owned, never taken from the client).
 */
export const supplierAgreementFormSchema = supplierAgreementFormObject
  .superRefine((data, ctx) => {
    const structured = data.paymentTermsMode === "structured";
    const prepayment = data.prepaymentPercent.trim();

    if (structured && !PERCENT_PATTERN.test(prepayment)) {
      ctx.addIssue({
        code: "custom",
        path: ["prepaymentPercent"],
        message: "invalidPrepaymentPercent" satisfies SupplierAgreementErrorCode,
      });
    }

    const balanceApplies = structured && prepayment !== "100";
    const balanceDays = data.balanceDueDays.trim();
    if (balanceApplies && balanceDays !== "" && !DAYS_PATTERN.test(balanceDays)) {
      ctx.addIssue({
        code: "custom",
        path: ["balanceDueDays"],
        message: "invalidDays" satisfies SupplierAgreementErrorCode,
      });
    }

    const leadTime = data.defaultLeadTimeDays.trim();
    if (leadTime !== "" && !DAYS_PATTERN.test(leadTime)) {
      ctx.addIssue({
        code: "custom",
        path: ["defaultLeadTimeDays"],
        message: "invalidDays" satisfies SupplierAgreementErrorCode,
      });
    }
  })
  .transform((data): z.input<typeof supplierAgreementTermsSchema> => {
    const prepaymentPercent = data.paymentTermsMode === "structured" ? intOrNull(data.prepaymentPercent) : null;
    const balanceApplies = prepaymentPercent !== null && prepaymentPercent !== 100;
    const incoterm = data.incoterm === "" ? null : data.incoterm;

    return {
      agreementNumber: data.agreementNumber,
      validFrom: data.validFrom.trim(),
      validTo: data.validTo.trim() === "" ? null : data.validTo.trim(),
      currency: data.currency,
      prepaymentPercent,
      balanceDueDays: balanceApplies ? intOrNull(data.balanceDueDays) : null,
      balanceDueBasis: balanceApplies && data.balanceDueBasis !== "" ? data.balanceDueBasis : null,
      paymentTermsNote: data.paymentTermsNote,
      incoterm,
      incotermVersion: incoterm === null ? null : SUPPORTED_INCOTERM_VERSION,
      incotermPlace: incoterm === null ? null : data.incotermPlace,
      defaultLeadTimeDays: intOrNull(data.defaultLeadTimeDays),
      notes: data.notes,
    };
  })
  .pipe(supplierAgreementTermsSchema);

export type SupplierAgreementFormValues = z.input<typeof supplierAgreementFormSchema>;
