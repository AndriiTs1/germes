import { describe, expect, it } from "vitest";

import {
  isAgreementCommerciallyEditable,
  supplierAgreementItemSchema,
  supplierAgreementPriceTierSchema,
  supplierAgreementTermsSchema,
} from "@/lib/validation/supplier-agreement";

const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";

/** A valid agreement with no structured payment terms and no Incoterm. */
const base = {
  agreementNumber: "DK-2026-17",
  validFrom: "2026-01-01",
  validTo: "2026-12-31",
  currency: "UAH",
  prepaymentPercent: null,
  balanceDueDays: null,
  balanceDueBasis: null,
  paymentTermsNote: null,
  incoterm: null,
  incotermVersion: null,
  incotermPlace: null,
  defaultLeadTimeDays: null,
  notes: null,
};

function terms(overrides: Record<string, unknown> = {}) {
  return supplierAgreementTermsSchema.safeParse({ ...base, ...overrides });
}

/** Error codes of a failed parse (empty when the parse succeeded). */
function codes(result: { success: boolean; error?: { issues: { message: string }[] } }): string[] {
  return result.success ? [] : (result.error?.issues.map((issue) => issue.message) ?? []);
}

describe("agreement terms — valid", () => {
  it("1. a regular UAH agreement", () => {
    const result = terms();
    expect(result.success).toBe(true);
    expect(result.data?.currency).toBe("UAH");
  });

  it("2. a regular EUR agreement", () => {
    expect(terms({ currency: "EUR" }).success).toBe(true);
  });

  it("3. open-ended: validTo = null", () => {
    expect(terms({ validTo: null }).success).toBe(true);
  });

  it("one-day agreement: validTo = validFrom", () => {
    expect(terms({ validTo: "2026-01-01" }).success).toBe(true);
  });

  it("4. no structured payment terms, only a note", () => {
    const result = terms({ paymentTermsNote: "  Per annex 2  " });
    expect(result.success).toBe(true);
    expect(result.data?.paymentTermsNote).toBe("Per annex 2");
  });

  it("5. 100% prepayment", () => {
    expect(terms({ prepaymentPercent: 100 }).success).toBe(true);
  });

  it("6. 0% prepayment + 30 days from INVOICE_DATE", () => {
    expect(terms({ prepaymentPercent: 0, balanceDueDays: 30, balanceDueBasis: "INVOICE_DATE" }).success).toBe(true);
  });

  it("payment on receipt: 0% + 0 days from RECEIPT_DATE", () => {
    expect(terms({ prepaymentPercent: 0, balanceDueDays: 0, balanceDueBasis: "RECEIPT_DATE" }).success).toBe(true);
  });

  it("7. 30% prepayment + 20 days from RECEIPT_DATE", () => {
    expect(terms({ prepaymentPercent: 30, balanceDueDays: 20, balanceDueBasis: "RECEIPT_DATE" }).success).toBe(true);
  });

  it("8. Incoterm DAP + 2020 + named place (stored separately, trimmed)", () => {
    const result = terms({ currency: "EUR", incoterm: "DAP", incotermVersion: 2020, incotermPlace: " Kyiv, Ukraine " });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ incoterm: "DAP", incotermVersion: 2020, incotermPlace: "Kyiv, Ukraine" });
  });

  it("11. defaultLeadTimeDays = 0", () => {
    expect(terms({ defaultLeadTimeDays: 0 }).success).toBe(true);
  });

  it("agreementNumber is trimmed", () => {
    expect(terms({ agreementNumber: "  DK-2026-17 " }).data?.agreementNumber).toBe("DK-2026-17");
  });
});

describe("agreement terms — invalid", () => {
  it("12. USD is rejected", () => {
    expect(codes(terms({ currency: "USD" }))).toContain("invalidCurrency");
  });

  it("lower-case/padded currency is rejected, not normalized", () => {
    expect(codes(terms({ currency: "eur" }))).toContain("invalidCurrency");
    expect(codes(terms({ currency: " UAH" }))).toContain("invalidCurrency");
  });

  it("13. validTo < validFrom", () => {
    expect(codes(terms({ validFrom: "2026-06-01", validTo: "2026-05-31" }))).toEqual(["validToBeforeValidFrom"]);
  });

  it("rolled-over calendar date is rejected", () => {
    expect(codes(terms({ validTo: "2026-02-30" }))).toContain("invalidDate");
  });

  it("empty agreementNumber is rejected", () => {
    expect(codes(terms({ agreementNumber: "   " }))).toContain("agreementNumberRequired");
  });

  it("14. prepaymentPercent < 0", () => {
    expect(codes(terms({ prepaymentPercent: -1 }))).toContain("invalidPrepaymentPercent");
  });

  it("15. prepaymentPercent > 100", () => {
    expect(codes(terms({ prepaymentPercent: 101 }))).toContain("invalidPrepaymentPercent");
  });

  it("16. 100% prepayment with a balance due", () => {
    expect(codes(terms({ prepaymentPercent: 100, balanceDueDays: 10 }))).toEqual(["balanceNotAllowed"]);
    expect(codes(terms({ prepaymentPercent: 100, balanceDueBasis: "RECEIPT_DATE" }))).toEqual(["balanceNotAllowed"]);
  });

  it("balance without any structured prepayment", () => {
    expect(codes(terms({ balanceDueDays: 10, balanceDueBasis: "ORDER_DATE" }))).toEqual(["balanceNotAllowed"]);
  });

  it("17. prepayment < 100 without balanceDueDays", () => {
    expect(codes(terms({ prepaymentPercent: 30, balanceDueBasis: "RECEIPT_DATE" }))).toEqual(["balanceDueDaysRequired"]);
  });

  it("18. prepayment < 100 without balanceDueBasis", () => {
    expect(codes(terms({ prepaymentPercent: 30, balanceDueDays: 20 }))).toEqual(["balanceDueBasisRequired"]);
  });

  it("19. Incoterm without a place", () => {
    expect(codes(terms({ incoterm: "DAP", incotermVersion: 2020 }))).toEqual(["incotermPlaceRequired"]);
    expect(codes(terms({ incoterm: "DAP", incotermVersion: 2020, incotermPlace: "  " }))).toEqual([
      "incotermPlaceRequired",
    ]);
  });

  it("20. Incoterm without a version", () => {
    expect(codes(terms({ incoterm: "DAP", incotermPlace: "Kyiv" }))).toEqual(["incotermVersionRequired"]);
  });

  it("21. incotermVersion other than 2020", () => {
    expect(codes(terms({ incoterm: "FCA", incotermVersion: 2010, incotermPlace: "Gdańsk" }))).toEqual([
      "unsupportedIncotermVersion",
    ]);
  });

  it("22. place/version without an Incoterm code", () => {
    expect(codes(terms({ incotermPlace: "Kyiv" }))).toEqual(["incotermDetailsWithoutCode"]);
    expect(codes(terms({ incotermVersion: 2020 }))).toEqual(["incotermDetailsWithoutCode"]);
  });

  it("unknown Incoterm code is rejected", () => {
    expect(terms({ incoterm: "DAT", incotermVersion: 2020, incotermPlace: "Kyiv" }).success).toBe(false);
  });

  it("23. negative defaultLeadTimeDays", () => {
    expect(codes(terms({ defaultLeadTimeDays: -1 }))).toContain("invalidDays");
  });
});

describe("agreement items and price tiers", () => {
  const item = (overrides: Record<string, unknown> = {}) =>
    supplierAgreementItemSchema.safeParse({
      productId: PRODUCT_ID,
      leadTimeDays: 7,
      priceTiers: [{ minQuantityKg: "1000", pricePerKg: "1.80" }],
      ...overrides,
    });

  it("9. base tier minQuantityKg = 0", () => {
    expect(supplierAgreementPriceTierSchema.safeParse({ minQuantityKg: "0", pricePerKg: "1.90" }).success).toBe(true);
  });

  it("10. tier minQuantityKg = 5000", () => {
    expect(supplierAgreementPriceTierSchema.safeParse({ minQuantityKg: "5000", pricePerKg: "1.65" }).success).toBe(true);
  });

  it("11. item leadTimeDays = 0", () => {
    expect(item({ leadTimeDays: 0 }).success).toBe(true);
  });

  it("an item with three quantity tiers", () => {
    expect(
      item({
        priceTiers: [
          { minQuantityKg: "0", pricePerKg: "1.90" },
          { minQuantityKg: "1000", pricePerKg: "1.80" },
          { minQuantityKg: "5000", pricePerKg: "1.65" },
        ],
      }).success,
    ).toBe(true);
  });

  it("23. negative item leadTimeDays", () => {
    expect(codes(item({ leadTimeDays: -1 }))).toContain("invalidDays");
  });

  it("24. negative minQuantityKg", () => {
    expect(codes(supplierAgreementPriceTierSchema.safeParse({ minQuantityKg: "-1", pricePerKg: "1.80" }))).toEqual([
      "invalidQuantity",
    ]);
  });

  it("25. pricePerKg <= 0", () => {
    expect(codes(supplierAgreementPriceTierSchema.safeParse({ minQuantityKg: "0", pricePerKg: "0" }))).toEqual([
      "pricePositive",
    ]);
    expect(codes(supplierAgreementPriceTierSchema.safeParse({ minQuantityKg: "0", pricePerKg: "0.0000" }))).toEqual([
      "pricePositive",
    ]);
    expect(codes(supplierAgreementPriceTierSchema.safeParse({ minQuantityKg: "0", pricePerKg: "-1.80" }))).toEqual([
      "invalidPrice",
    ]);
  });

  it("two tiers with the same threshold are rejected", () => {
    expect(
      codes(
        item({
          priceTiers: [
            { minQuantityKg: "1000", pricePerKg: "1.80" },
            { minQuantityKg: "1000.0", pricePerKg: "1.75" },
          ],
        }),
      ),
    ).toEqual(["duplicateTier"]);
  });
});

describe("commercial editability", () => {
  it("only a DRAFT agreement is commercially editable", () => {
    expect(isAgreementCommerciallyEditable("DRAFT")).toBe(true);
    expect(isAgreementCommerciallyEditable("ACTIVE")).toBe(false);
    expect(isAgreementCommerciallyEditable("CLOSED")).toBe(false);
  });
});
