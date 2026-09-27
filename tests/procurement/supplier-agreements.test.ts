import { beforeEach, describe, expect, it, vi } from "vitest";

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
  incoterm: string | null;
  incotermPlace: string | null;
};

const m = vi.hoisted(() => ({
  agreements: [] as AgreementRow[],
  supplierFindUnique: vi.fn(),
  agreementFindMany: vi.fn(),
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
    supplierAgreement: { findMany: m.agreementFindMany },
  },
}));
vi.mock("@/lib/permissions/require-permission", () => ({ requirePermission: m.requirePermission }));
vi.mock("@/lib/permissions/get-current-user-permissions", () => ({
  getPermissionCodesForUser: m.getPermissionCodesForUser,
}));
vi.mock("@/lib/i18n/locale", () => ({ getCurrentLocale: async () => "uk" }));
vi.mock("next/navigation", () => ({ redirect: m.redirect, notFound: m.notFound }));
vi.mock("@/components/dashboard/dashboard-shell", () => ({ DashboardShell: () => null }));

import SupplierAgreementsPage from "@/app/procurement/suppliers/[id]/agreements/page";
import { listSupplierAgreements } from "@/lib/services/procurement/list-supplier-agreements";
import {
  getAgreementDisplayStatus,
  getBusinessDate,
} from "@/lib/services/procurement/supplier-agreement-display-status";

const SUPPLIER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_SUPPLIER_ID = "22222222-2222-4222-8222-222222222222";
const TODAY = "2026-09-27";

function utc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function row(overrides: Partial<AgreementRow> & Pick<AgreementRow, "id" | "agreementNumber">): AgreementRow {
  return {
    supplierId: SUPPLIER_ID,
    status: "ACTIVE",
    validFrom: utc("2026-01-01"),
    validTo: utc("2026-12-31"),
    currency: "EUR",
    prepaymentPercent: null,
    balanceDueDays: null,
    balanceDueBasis: null,
    incoterm: null,
    incotermPlace: null,
    ...overrides,
  };
}

const supplierRow = {
  id: SUPPLIER_ID,
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

function pageProps(id = SUPPLIER_ID) {
  return {
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({}),
  } as unknown as PageProps<"/procurement/suppliers/[id]/agreements">;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.agreements = [];
  // Fake findMany honours the only filter the service uses: where.supplierId.
  m.agreementFindMany.mockImplementation(async ({ where }: { where: { supplierId: string } }) =>
    m.agreements.filter((agreement) => agreement.supplierId === where.supplierId),
  );
  m.supplierFindUnique.mockResolvedValue(supplierRow);
  m.requirePermission.mockResolvedValue({ id: "user-1" });
  m.getPermissionCodesForUser.mockResolvedValue(["procurement.overview.read", "suppliers.read"]);
});

describe("listSupplierAgreements", () => {
  it("1. supplier without agreements → []", async () => {
    expect(await listSupplierAgreements(SUPPLIER_ID, TODAY)).toEqual([]);
  });

  it("2. returns only this supplier's agreements", async () => {
    m.agreements = [
      row({ id: "a1", agreementNumber: "DK-2026-17" }),
      row({ id: "a2", agreementNumber: "PL-2026-01", supplierId: OTHER_SUPPLIER_ID }),
    ];

    const result = await listSupplierAgreements(SUPPLIER_ID, TODAY);

    expect(result.map((agreement) => agreement.agreementNumber)).toEqual(["DK-2026-17"]);
    expect(m.agreementFindMany.mock.calls[0][0].where).toEqual({ supplierId: SUPPLIER_ID });
  });

  it("3. nullable validTo → open-ended, still in force", async () => {
    m.agreements = [row({ id: "a1", agreementNumber: "OPEN-1", validTo: null })];

    const [agreement] = await listSupplierAgreements(SUPPLIER_ID, TODAY);

    expect(agreement).toMatchObject({ validFrom: "2026-01-01", validTo: null, displayStatus: "ACTIVE" });
  });

  it("maps dates to YYYY-MM-DD and keeps the structured terms", async () => {
    m.agreements = [
      row({
        id: "a1",
        agreementNumber: "DK-2026-17",
        prepaymentPercent: 30,
        balanceDueDays: 20,
        balanceDueBasis: "RECEIPT_DATE",
        incoterm: "DAP",
        incotermPlace: "Kyiv, Ukraine",
      }),
    ];

    expect((await listSupplierAgreements(SUPPLIER_ID, TODAY))[0]).toEqual({
      id: "a1",
      agreementNumber: "DK-2026-17",
      status: "ACTIVE",
      displayStatus: "ACTIVE",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
      currency: "EUR",
      prepaymentPercent: 30,
      balanceDueDays: 20,
      balanceDueBasis: "RECEIPT_DATE",
      incoterm: "DAP",
      incotermPlace: "Kyiv, Ukraine",
    });
  });

  it("4. order is deterministic: in force, upcoming, expired, draft, closed; then newest validFrom, number, id", async () => {
    const rows = [
      row({ id: "c1", agreementNumber: "CLOSED-1", status: "CLOSED" }),
      row({ id: "d1", agreementNumber: "DRAFT-1", status: "DRAFT" }),
      row({ id: "e1", agreementNumber: "EXPIRED-1", validFrom: utc("2025-01-01"), validTo: utc("2025-12-31") }),
      row({ id: "u1", agreementNumber: "UPCOMING-1", validFrom: utc("2027-01-01"), validTo: null }),
      row({ id: "a-old", agreementNumber: "ACTIVE-OLD", validFrom: utc("2026-01-01") }),
      row({ id: "a-new", agreementNumber: "ACTIVE-NEW", validFrom: utc("2026-06-01") }),
      row({ id: "a-b", agreementNumber: "ACTIVE-B", validFrom: utc("2026-03-01") }),
      row({ id: "a-a", agreementNumber: "ACTIVE-A", validFrom: utc("2026-03-01") }),
    ];
    const expected = ["ACTIVE-NEW", "ACTIVE-A", "ACTIVE-B", "ACTIVE-OLD", "UPCOMING-1", "EXPIRED-1", "DRAFT-1", "CLOSED-1"];

    m.agreements = rows;
    const first = (await listSupplierAgreements(SUPPLIER_ID, TODAY)).map((agreement) => agreement.agreementNumber);
    m.agreements = [...rows].reverse();
    const second = (await listSupplierAgreements(SUPPLIER_ID, TODAY)).map((agreement) => agreement.agreementNumber);

    expect(first).toEqual(expected);
    expect(second).toEqual(expected);
  });
});

describe("getAgreementDisplayStatus", () => {
  const period = { validFrom: "2026-01-01", validTo: "2026-12-31" };

  it("5. DRAFT → DRAFT (regardless of dates)", () => {
    expect(getAgreementDisplayStatus({ status: "DRAFT", ...period }, "2030-01-01")).toBe("DRAFT");
  });

  it("6. CLOSED → CLOSED (regardless of dates)", () => {
    expect(getAgreementDisplayStatus({ status: "CLOSED", ...period }, "2026-06-01")).toBe("CLOSED");
  });

  it("7. ACTIVE before validFrom → UPCOMING", () => {
    expect(getAgreementDisplayStatus({ status: "ACTIVE", ...period }, "2025-12-31")).toBe("UPCOMING");
  });

  it("8. ACTIVE inside the period → ACTIVE", () => {
    expect(getAgreementDisplayStatus({ status: "ACTIVE", ...period }, "2026-06-15")).toBe("ACTIVE");
  });

  it("9. ACTIVE after validTo → EXPIRED", () => {
    expect(getAgreementDisplayStatus({ status: "ACTIVE", ...period }, "2027-01-01")).toBe("EXPIRED");
  });

  it("10. ACTIVE with validTo = null → ACTIVE, even years later", () => {
    expect(getAgreementDisplayStatus({ status: "ACTIVE", validFrom: "2026-01-01", validTo: null }, "2040-01-01")).toBe(
      "ACTIVE",
    );
  });

  it("11. businessDate == validFrom → ACTIVE", () => {
    expect(getAgreementDisplayStatus({ status: "ACTIVE", ...period }, "2026-01-01")).toBe("ACTIVE");
  });

  it("12. businessDate == validTo → ACTIVE", () => {
    expect(getAgreementDisplayStatus({ status: "ACTIVE", ...period }, "2026-12-31")).toBe("ACTIVE");
  });

  it("one-day agreement is in force exactly on that day", () => {
    const oneDay = { status: "ACTIVE" as const, validFrom: "2026-05-01", validTo: "2026-05-01" };
    expect(getAgreementDisplayStatus(oneDay, "2026-04-30")).toBe("UPCOMING");
    expect(getAgreementDisplayStatus(oneDay, "2026-05-01")).toBe("ACTIVE");
    expect(getAgreementDisplayStatus(oneDay, "2026-05-02")).toBe("EXPIRED");
  });
});

describe("getBusinessDate", () => {
  it("uses the Kyiv calendar date, independent of the runtime timezone", () => {
    // 22:30 UTC on Dec 31 is already Jan 1 in Kyiv (UTC+2 in winter).
    expect(getBusinessDate(new Date("2026-12-31T22:30:00Z"))).toBe("2027-01-01");
    // 20:59 UTC on Sep 27 is 23:59 in Kyiv (UTC+3 in summer) — same day.
    expect(getBusinessDate(new Date("2026-09-27T20:59:00Z"))).toBe("2026-09-27");
  });
});

describe("/procurement/suppliers/[id]/agreements page access", () => {
  it("13a. without procurement.overview.read → redirect; nothing read", async () => {
    m.requirePermission.mockRejectedValue(new Error("Forbidden"));

    await expect(SupplierAgreementsPage(pageProps())).rejects.toThrow("REDIRECT:/");
    expect(m.requirePermission).toHaveBeenCalledWith("procurement.overview.read");
    expect(m.supplierFindUnique).not.toHaveBeenCalled();
    expect(m.agreementFindMany).not.toHaveBeenCalled();
  });

  it("13b. without suppliers.read → redirect; nothing read", async () => {
    m.getPermissionCodesForUser.mockResolvedValue(["procurement.overview.read"]);

    await expect(SupplierAgreementsPage(pageProps())).rejects.toThrow("REDIRECT:/");
    expect(m.supplierFindUnique).not.toHaveBeenCalled();
    expect(m.agreementFindMany).not.toHaveBeenCalled();
  });

  it("14. unknown supplier → notFound(); agreements never read", async () => {
    m.supplierFindUnique.mockResolvedValue(null);

    await expect(SupplierAgreementsPage(pageProps("no-such-id"))).rejects.toThrow("NOT_FOUND");
    expect(m.agreementFindMany).not.toHaveBeenCalled();
  });

  it("15. renders for a user with both permissions and reads that supplier's agreements", async () => {
    await expect(SupplierAgreementsPage(pageProps())).resolves.toBeTruthy();
    expect(m.redirect).not.toHaveBeenCalled();
    expect(m.notFound).not.toHaveBeenCalled();
    expect(m.agreementFindMany.mock.calls[0][0].where).toEqual({ supplierId: SUPPLIER_ID });
  });
});
