import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/lib/generated/prisma/client";

type TierRow = { id: string; minQuantityKg: Prisma.Decimal; pricePerKg: Prisma.Decimal };
type ItemRow = {
  id: string;
  productId: string;
  leadTimeDays: number | null;
  product: { sku: string; name: string };
  priceTiers: TierRow[];
};
type AgreementRow = {
  id: string;
  supplierId: string;
  agreementNumber: string;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  validFrom: Date;
  validTo: Date | null;
  currency: string;
  prepaymentPercent: number | null;
  balanceDueDays: number | null;
  balanceDueBasis: "ORDER_DATE" | "INVOICE_DATE" | "RECEIPT_DATE" | null;
  paymentTermsNote: string | null;
  incoterm: string | null;
  incotermVersion: number | null;
  incotermPlace: string | null;
  defaultLeadTimeDays: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: ItemRow[];
};

const m = vi.hoisted(() => ({
  agreements: [] as AgreementRow[],
  supplierFindUnique: vi.fn(),
  agreementFindFirst: vi.fn(),
  requirePermission: vi.fn(),
  getPermissionCodesForUser: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    supplier: { findUnique: m.supplierFindUnique },
    supplierAgreement: { findFirst: m.agreementFindFirst },
  },
}));
vi.mock("@/lib/permissions/require-permission", () => ({ requirePermission: m.requirePermission }));
vi.mock("@/lib/permissions/get-current-user-permissions", () => ({
  getPermissionCodesForUser: m.getPermissionCodesForUser,
}));
vi.mock("@/lib/i18n/locale", () => ({ getCurrentLocale: async () => "ru" }));
vi.mock("next/navigation", () => ({ redirect: m.redirect, notFound: m.notFound }));
vi.mock("@/components/dashboard/dashboard-shell", () => ({ DashboardShell: () => null }));

import SupplierAgreementDetailPage from "@/app/procurement/suppliers/[id]/agreements/[agreementId]/page";
import {
  formatIncoterm,
  formatPaymentTermLines,
  formatPricePerKg,
  formatTierQuantity,
  getSupplierAgreementHref,
  resolveItemLeadTime,
} from "@/components/procurement/supplier-agreement-format";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getSupplierAgreementDetail } from "@/lib/services/procurement/get-supplier-agreement-detail";

const SUPPLIER_A = "11111111-1111-4111-8111-111111111111";
const SUPPLIER_B = "22222222-2222-4222-8222-222222222222";
const AGREEMENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AGREEMENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TODAY = "2026-09-27";

const ru = getDictionary("ru");
const listT = ru.procurement.supplierDetail.agreements;

const d = (value: string) => new Prisma.Decimal(value);
const utc = (date: string) => new Date(`${date}T00:00:00Z`);

function agreementRow(overrides: Partial<AgreementRow> = {}): AgreementRow {
  return {
    id: AGREEMENT_A,
    supplierId: SUPPLIER_A,
    agreementNumber: "DK-2026-17",
    status: "ACTIVE",
    validFrom: utc("2026-01-01"),
    validTo: utc("2026-12-31"),
    currency: "EUR",
    prepaymentPercent: 30,
    balanceDueDays: 20,
    balanceDueBasis: "RECEIPT_DATE",
    paymentTermsNote: null,
    incoterm: "DAP",
    incotermVersion: 2020,
    incotermPlace: "Kyiv, Ukraine",
    defaultLeadTimeDays: 7,
    notes: null,
    createdAt: new Date("2026-09-01T10:00:00Z"),
    updatedAt: new Date("2026-09-02T10:00:00Z"),
    items: [
      {
        id: "item-1",
        productId: "33333333-3333-4333-8333-333333333333",
        leadTimeDays: null,
        product: { sku: "PORK-EARS", name: "Вуха свинячі" },
        // Deliberately out of order: the database orders them (see the fake).
        priceTiers: [
          { id: "t3", minQuantityKg: d("5000"), pricePerKg: d("1.65") },
          { id: "t1", minQuantityKg: d("0"), pricePerKg: d("1.9") },
          { id: "t2", minQuantityKg: d("1000"), pricePerKg: d("1.8") },
        ],
      },
    ],
    ...overrides,
  };
}

const supplierRow = {
  id: SUPPLIER_A,
  code: "SUP-005",
  name: "ESS-FOOD A/S",
  status: "ACTIVE",
  legalName: null,
  taxId: null,
  country: "Данія",
  contactPerson: null,
  phone: null,
  email: null,
  address: null,
  notes: null,
  responsible: null,
};

function pageProps(id = SUPPLIER_A, agreementId = AGREEMENT_A) {
  return {
    params: Promise.resolve({ id, agreementId }),
    searchParams: Promise.resolve({}),
  } as unknown as PageProps<"/procurement/suppliers/[id]/agreements/[agreementId]">;
}

type FindFirstArgs = {
  where: { id: string; supplierId: string };
  select: { items: { select: { priceTiers: { orderBy: { minQuantityKg: "asc" | "desc" } } } } };
};

beforeEach(() => {
  vi.clearAllMocks();
  m.agreements = [agreementRow(), agreementRow({ id: AGREEMENT_B, supplierId: SUPPLIER_B, agreementNumber: "PL-1" })];
  // Honours the service's where (id AND supplierId) and the tier orderBy it asks for, like the DB would.
  m.agreementFindFirst.mockImplementation(async ({ where, select }: FindFirstArgs) => {
    const found = m.agreements.find((row) => row.id === where.id && row.supplierId === where.supplierId);
    if (!found) return null;
    const direction = select.items.select.priceTiers.orderBy.minQuantityKg === "asc" ? 1 : -1;
    return {
      ...found,
      items: found.items.map((item) => ({
        ...item,
        priceTiers: [...item.priceTiers].sort((a, b) => direction * a.minQuantityKg.comparedTo(b.minQuantityKg)),
      })),
    };
  });
  m.supplierFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id === SUPPLIER_A ? supplierRow : where.id === SUPPLIER_B ? { ...supplierRow, id: SUPPLIER_B } : null,
  );
  m.requirePermission.mockResolvedValue({ id: "user-1" });
  m.getPermissionCodesForUser.mockResolvedValue(["procurement.overview.read", "suppliers.read"]);
});

const detail = (supplierId = SUPPLIER_A, agreementId = AGREEMENT_A, businessDate = TODAY) =>
  getSupplierAgreementDetail({ supplierId, agreementId, businessDate });

describe("getSupplierAgreementDetail", () => {
  it("1. returns the agreement of this supplier", async () => {
    const result = await detail();
    expect(result).toMatchObject({
      id: AGREEMENT_A,
      supplierId: SUPPLIER_A,
      agreementNumber: "DK-2026-17",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
      currency: "EUR",
      incoterm: "DAP",
      incotermVersion: 2020,
      incotermPlace: "Kyiv, Ukraine",
      defaultLeadTimeDays: 7,
      createdAt: "2026-09-01T10:00:00.000Z",
    });
    expect(m.agreementFindFirst.mock.calls[0][0].where).toEqual({ id: AGREEMENT_A, supplierId: SUPPLIER_A });
  });

  it("2. another supplier's agreement is not returned", async () => {
    expect(await detail(SUPPLIER_A, AGREEMENT_B)).toBeNull();
  });

  it("3. nonexistent agreement → null", async () => {
    expect(await detail(SUPPLIER_A, "no-such-agreement")).toBeNull();
  });

  it("4. validTo = null (open-ended) works", async () => {
    m.agreements = [agreementRow({ validTo: null })];
    expect(await detail(SUPPLIER_A, AGREEMENT_A, "2040-01-01")).toMatchObject({ validTo: null, displayStatus: "ACTIVE" });
  });

  it("5 + 7. items are loaded with the product name and SKU", async () => {
    const result = await detail();
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0]).toMatchObject({
      id: "item-1",
      productId: "33333333-3333-4333-8333-333333333333",
      productName: "Вуха свинячі",
      sku: "PORK-EARS",
      leadTimeDays: null,
    });
  });

  it("6. price tiers are ascending by minQuantityKg, decimals as strings", async () => {
    const result = await detail();
    expect(result?.items[0].priceTiers).toEqual([
      { id: "t1", minQuantityKg: "0", pricePerKg: "1.9" },
      { id: "t2", minQuantityKg: "1000", pricePerKg: "1.8" },
      { id: "t3", minQuantityKg: "5000", pricePerKg: "1.65" },
    ]);
    const select = m.agreementFindFirst.mock.calls[0][0].select;
    expect(select.items.select.priceTiers.orderBy).toEqual({ minQuantityKg: "asc" });
    expect(select.items.orderBy).toEqual([{ product: { name: "asc" } }, { id: "asc" }]);
  });

  it("8. display status comes from the given businessDate", async () => {
    expect((await detail(SUPPLIER_A, AGREEMENT_A, "2025-12-31"))?.displayStatus).toBe("UPCOMING");
    expect((await detail(SUPPLIER_A, AGREEMENT_A, "2026-06-01"))?.displayStatus).toBe("ACTIVE");
    expect((await detail(SUPPLIER_A, AGREEMENT_A, "2027-01-01"))?.displayStatus).toBe("EXPIRED");
  });

  it("blank notes / paymentTermsNote become null", async () => {
    m.agreements = [agreementRow({ notes: "   ", paymentTermsNote: "" })];
    expect(await detail()).toMatchObject({ notes: null, paymentTermsNote: null });
  });
});

describe("agreement formatting", () => {
  const terms = (prepaymentPercent: number | null, balanceDueDays: number | null, balanceDueBasis: AgreementRow["balanceDueBasis"]) =>
    formatPaymentTermLines({ prepaymentPercent, balanceDueDays, balanceDueBasis }, "ru", listT);

  it("9. 100% prepayment", () => {
    expect(terms(100, null, null)).toEqual(["100% предоплата"]);
  });

  it("10. 0% + 30 days from INVOICE_DATE", () => {
    expect(terms(0, 30, "INVOICE_DATE")).toEqual(["100% через 30 дн. от даты инвойса"]);
  });

  it("11. 30% + 70% in 20 days after RECEIPT_DATE", () => {
    expect(terms(30, 20, "RECEIPT_DATE")).toEqual(["30% предоплата", "70% через 20 дн. после приёмки"]);
  });

  it("payment on receipt (0 days)", () => {
    expect(terms(0, 0, "RECEIPT_DATE")).toEqual(["100% при приёмке"]);
  });

  it("12. no structured payment terms → no lines", () => {
    expect(terms(null, null, null)).toEqual([]);
  });

  it("13. Incoterm DAP + place (version shown separately)", () => {
    expect(formatIncoterm({ incoterm: "DAP", incotermPlace: "Kyiv, Ukraine" })).toBe("DAP · Kyiv, Ukraine");
    expect(
      ru.procurement.supplierDetail.agreementDetail.incotermsVersion.replace("{version}", String(2020)),
    ).toBe("Incoterms® 2020");
  });

  it("14. no Incoterm → null", () => {
    expect(formatIncoterm({ incoterm: null, incotermPlace: null })).toBeNull();
  });

  it("15. item lead time overrides the agreement default (including 0)", () => {
    expect(resolveItemLeadTime(3, 7)).toEqual({ days: 3, source: "item" });
    expect(resolveItemLeadTime(0, 7)).toEqual({ days: 0, source: "item" });
  });

  it("16. falls back to Agreement.defaultLeadTimeDays", () => {
    expect(resolveItemLeadTime(null, 7)).toEqual({ days: 7, source: "agreement" });
  });

  it("17. both lead times missing → null", () => {
    expect(resolveItemLeadTime(null, null)).toBeNull();
  });

  it("18. tier minQuantity 0 is shown as 0 kg; prices keep up to 4 decimals", () => {
    expect(formatTierQuantity("0", "кг", "ru")).toBe("0 кг");
    expect(formatTierQuantity("5000", "кг", "en")).toBe("5,000 кг");
    expect(formatPricePerKg("1.9", "EUR", "kg", "en")).toBe("1.90 EUR/kg");
    expect(formatPricePerKg("1.6525", "EUR", "kg", "en")).toBe("1.6525 EUR/kg");
  });
});

describe("/procurement/suppliers/[id]/agreements/[agreementId] page access", () => {
  it("19. without procurement.overview.read → redirect; nothing read", async () => {
    m.requirePermission.mockRejectedValue(new Error("Forbidden"));
    await expect(SupplierAgreementDetailPage(pageProps())).rejects.toThrow("REDIRECT:/");
    expect(m.supplierFindUnique).not.toHaveBeenCalled();
    expect(m.agreementFindFirst).not.toHaveBeenCalled();
  });

  it("20. without suppliers.read → redirect; nothing read", async () => {
    m.getPermissionCodesForUser.mockResolvedValue(["procurement.overview.read"]);
    await expect(SupplierAgreementDetailPage(pageProps())).rejects.toThrow("REDIRECT:/");
    expect(m.supplierFindUnique).not.toHaveBeenCalled();
    expect(m.agreementFindFirst).not.toHaveBeenCalled();
  });

  it("21. unknown supplier → notFound; agreement never read", async () => {
    await expect(SupplierAgreementDetailPage(pageProps("no-such-supplier"))).rejects.toThrow("NOT_FOUND");
    expect(m.agreementFindFirst).not.toHaveBeenCalled();
  });

  it("22. unknown agreement → notFound", async () => {
    await expect(SupplierAgreementDetailPage(pageProps(SUPPLIER_A, "no-such-agreement"))).rejects.toThrow("NOT_FOUND");
  });

  it("23. another supplier's agreement → notFound (same as missing)", async () => {
    await expect(SupplierAgreementDetailPage(pageProps(SUPPLIER_A, AGREEMENT_B))).rejects.toThrow("NOT_FOUND");
    expect(m.agreementFindFirst.mock.calls[0][0].where).toEqual({ id: AGREEMENT_B, supplierId: SUPPLIER_A });
  });

  it("24. a valid agreement renders", async () => {
    await expect(SupplierAgreementDetailPage(pageProps())).resolves.toBeTruthy();
    expect(m.redirect).not.toHaveBeenCalled();
    expect(m.notFound).not.toHaveBeenCalled();
  });
});

describe("agreements list link", () => {
  it("25. href is built from supplierId + agreementId", () => {
    expect(getSupplierAgreementHref(SUPPLIER_A, AGREEMENT_A)).toBe(
      `/procurement/suppliers/${SUPPLIER_A}/agreements/${AGREEMENT_A}`,
    );
  });
});
