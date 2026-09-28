import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/lib/generated/prisma/client";

const m = vi.hoisted(() => {
  const tx = {
    supplier: { findUnique: vi.fn() },
    supplierAgreement: { create: vi.fn() },
    supplierAgreementItem: { create: vi.fn(), createMany: vi.fn() },
    supplierAgreementPriceTier: { create: vi.fn(), createMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(),
    rootSupplierFindUnique: vi.fn(),
    rootAgreementCreate: vi.fn(),
    rootAgreementFindMany: vi.fn(),
    rootAuditCreate: vi.fn(),
    requirePermission: vi.fn(),
    getPermissionCodesForUser: vi.fn(),
    revalidatePath: vi.fn(),
    redirect: vi.fn((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    }),
    notFound: vi.fn(() => {
      throw new Error("NOT_FOUND");
    }),
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: m.transaction,
    supplier: { findUnique: m.rootSupplierFindUnique },
    supplierAgreement: { create: m.rootAgreementCreate, findMany: m.rootAgreementFindMany },
    auditLog: { create: m.rootAuditCreate },
  },
}));
vi.mock("@/lib/permissions/require-permission", () => ({ requirePermission: m.requirePermission }));
vi.mock("@/lib/permissions/get-current-user-permissions", () => ({
  getPermissionCodesForUser: m.getPermissionCodesForUser,
}));
vi.mock("@/lib/i18n/locale", () => ({ getCurrentLocale: async () => "ru" }));
vi.mock("next/navigation", () => ({ redirect: m.redirect, notFound: m.notFound }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@/components/dashboard/dashboard-shell", () => ({ DashboardShell: () => null }));

import { createSupplierAgreementAction } from "@/app/procurement/suppliers/[id]/agreements/new/actions";
import NewSupplierAgreementPage from "@/app/procurement/suppliers/[id]/agreements/new/page";
import SupplierAgreementsPage from "@/app/procurement/suppliers/[id]/agreements/page";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { createSupplierAgreement } from "@/lib/services/procurement/create-supplier-agreement";
import {
  supplierAgreementFormSchema,
  type SupplierAgreementFormValues,
} from "@/lib/validation/supplier-agreement";

const SUPPLIER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_SUPPLIER_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "user-1";
const NEW_AGREEMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const t = getDictionary("ru").procurement.supplierDetail.agreementForm;

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

const minimalForm: SupplierAgreementFormValues = {
  agreementNumber: "DK-2026-17",
  validFrom: "2026-01-01",
  validTo: "2026-12-31",
  currency: "EUR",
  paymentTermsMode: "none",
  prepaymentPercent: "",
  balanceDueDays: "",
  balanceDueBasis: "",
  paymentTermsNote: "",
  incoterm: "",
  incotermPlace: "",
  defaultLeadTimeDays: "",
  notes: "",
};

function form(overrides: Partial<Record<keyof SupplierAgreementFormValues, string>> = {}) {
  return supplierAgreementFormSchema.safeParse({ ...minimalForm, ...overrides });
}

function codes(result: { success: boolean; error?: { issues: { message: string }[] } }): string[] {
  return result.success ? [] : (result.error?.issues.map((issue) => issue.message) ?? []);
}

function pageProps<T>(id = SUPPLIER_ID) {
  return { params: Promise.resolve({ id }), searchParams: Promise.resolve({}) } as unknown as T;
}

/** Depth-first search of a (not rendered) React element tree for an element with the given href. */
function findHref(node: ReactNode, href: string): boolean {
  if (node === null || node === undefined || typeof node === "boolean") return false;
  if (Array.isArray(node)) return node.some((child) => findHref(child, href));
  if (typeof node !== "object") return false;
  const element = node as ReactElement<{ href?: string; children?: ReactNode }>;
  if (element.props?.href === href) return true;
  return findHref(element.props?.children, href);
}

beforeEach(() => {
  vi.clearAllMocks();
  m.transaction.mockImplementation(async (callback: (tx: typeof m.tx) => Promise<unknown>) => callback(m.tx));
  m.tx.supplier.findUnique.mockResolvedValue({ id: SUPPLIER_ID });
  m.tx.supplierAgreement.create.mockResolvedValue({ id: NEW_AGREEMENT_ID });
  m.tx.auditLog.create.mockResolvedValue({});
  m.rootSupplierFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id === SUPPLIER_ID ? supplierRow : null,
  );
  m.rootAgreementFindMany.mockResolvedValue([]);
  m.requirePermission.mockResolvedValue({ id: USER_ID });
  m.getPermissionCodesForUser.mockResolvedValue(["procurement.overview.read", "suppliers.read", "suppliers.update"]);
});

describe("/agreements/new page access", () => {
  type Props = PageProps<"/procurement/suppliers/[id]/agreements/new">;

  it("1. without procurement.overview.read → redirect", async () => {
    m.requirePermission.mockRejectedValue(new Error("Forbidden"));
    await expect(NewSupplierAgreementPage(pageProps<Props>())).rejects.toThrow("REDIRECT:/");
    expect(m.requirePermission).toHaveBeenCalledWith("procurement.overview.read");
    expect(m.rootSupplierFindUnique).not.toHaveBeenCalled();
  });

  it("2. without suppliers.read → redirect", async () => {
    m.getPermissionCodesForUser.mockResolvedValue(["procurement.overview.read", "suppliers.update"]);
    await expect(NewSupplierAgreementPage(pageProps<Props>())).rejects.toThrow("REDIRECT:/");
    expect(m.rootSupplierFindUnique).not.toHaveBeenCalled();
  });

  it("3. without suppliers.update → redirect (no form)", async () => {
    m.getPermissionCodesForUser.mockResolvedValue(["procurement.overview.read", "suppliers.read"]);
    await expect(NewSupplierAgreementPage(pageProps<Props>())).rejects.toThrow("REDIRECT:/");
    expect(m.rootSupplierFindUnique).not.toHaveBeenCalled();
  });

  it("4. unknown supplier → notFound", async () => {
    await expect(NewSupplierAgreementPage(pageProps<Props>("no-such-supplier"))).rejects.toThrow("NOT_FOUND");
  });

  it("5. with all permissions the create page renders", async () => {
    await expect(NewSupplierAgreementPage(pageProps<Props>())).resolves.toBeTruthy();
    expect(m.redirect).not.toHaveBeenCalled();
  });
});

describe("agreements list — New agreement action", () => {
  type Props = PageProps<"/procurement/suppliers/[id]/agreements">;
  const newHref = `/procurement/suppliers/${SUPPLIER_ID}/agreements/new`;

  it("6. a user with suppliers.update gets the New agreement link", async () => {
    const page = await SupplierAgreementsPage(pageProps<Props>());
    expect(findHref(page, newHref)).toBe(true);
  });

  it("7. a read-only user does not", async () => {
    m.getPermissionCodesForUser.mockResolvedValue(["procurement.overview.read", "suppliers.read"]);
    const page = await SupplierAgreementsPage(pageProps<Props>());
    expect(findHref(page, newHref)).toBe(false);
  });
});

describe("create form parsing", () => {
  it("8. minimal valid agreement", () => {
    const result = form();
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      agreementNumber: "DK-2026-17",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
      currency: "EUR",
      prepaymentPercent: null,
      incoterm: null,
      incotermVersion: null,
      incotermPlace: null,
      defaultLeadTimeDays: null,
    });
  });

  it("9. UAH", () => {
    expect(form({ currency: "UAH" }).data?.currency).toBe("UAH");
  });

  it("10. EUR", () => {
    expect(form({ currency: "EUR" }).data?.currency).toBe("EUR");
  });

  it("no currency chosen / USD are rejected", () => {
    expect(codes(form({ currency: "" }))).toContain("invalidCurrency");
    expect(codes(form({ currency: "USD" }))).toContain("invalidCurrency");
  });

  it("11. empty validTo → open-ended (null)", () => {
    expect(form({ validTo: "" }).data?.validTo).toBeNull();
  });

  it("missing validFrom is rejected", () => {
    expect(codes(form({ validFrom: "" }))).toContain("invalidDate");
  });

  it("12. validTo before validFrom is rejected", () => {
    expect(codes(form({ validFrom: "2026-06-01", validTo: "2026-05-31" }))).toEqual(["validToBeforeValidFrom"]);
  });

  it("13. no payment terms → null/null/null, note kept", () => {
    const result = form({
      paymentTermsMode: "none",
      prepaymentPercent: "30",
      balanceDueDays: "20",
      balanceDueBasis: "RECEIPT_DATE",
      paymentTermsNote: "Per annex 2",
    });
    expect(result.data).toMatchObject({
      prepaymentPercent: null,
      balanceDueDays: null,
      balanceDueBasis: null,
      paymentTermsNote: "Per annex 2",
    });
  });

  it("14. 100% prepayment drops stale balance inputs", () => {
    const result = form({
      paymentTermsMode: "structured",
      prepaymentPercent: "100",
      balanceDueDays: "20",
      balanceDueBasis: "RECEIPT_DATE",
    });
    expect(result.data).toMatchObject({ prepaymentPercent: 100, balanceDueDays: null, balanceDueBasis: null });
  });

  it("15. 0% + 30 days from INVOICE_DATE", () => {
    const result = form({
      paymentTermsMode: "structured",
      prepaymentPercent: "0",
      balanceDueDays: "30",
      balanceDueBasis: "INVOICE_DATE",
    });
    expect(result.data).toMatchObject({ prepaymentPercent: 0, balanceDueDays: 30, balanceDueBasis: "INVOICE_DATE" });
  });

  it("16. 30/70 + 20 days after RECEIPT_DATE", () => {
    const result = form({
      paymentTermsMode: "structured",
      prepaymentPercent: "30",
      balanceDueDays: "20",
      balanceDueBasis: "RECEIPT_DATE",
    });
    expect(result.data).toMatchObject({ prepaymentPercent: 30, balanceDueDays: 20, balanceDueBasis: "RECEIPT_DATE" });
  });

  it("structured terms: missing prepayment / days / basis are field errors", () => {
    expect(codes(form({ paymentTermsMode: "structured" }))).toContain("invalidPrepaymentPercent");
    expect(codes(form({ paymentTermsMode: "structured", prepaymentPercent: "30", balanceDueBasis: "ORDER_DATE" }))).toEqual([
      "balanceDueDaysRequired",
    ]);
    expect(codes(form({ paymentTermsMode: "structured", prepaymentPercent: "30", balanceDueDays: "20" }))).toEqual([
      "balanceDueBasisRequired",
    ]);
    expect(codes(form({ paymentTermsMode: "structured", prepaymentPercent: "150" }))).toContain(
      "invalidPrepaymentPercent",
    );
    expect(codes(form({ paymentTermsMode: "structured", prepaymentPercent: "12.5" }))).toContain(
      "invalidPrepaymentPercent",
    );
  });

  it("17. no Incoterm clears version and a stale place", () => {
    const result = form({ incoterm: "", incotermPlace: "Kyiv, Ukraine" });
    expect(result.data).toMatchObject({ incoterm: null, incotermVersion: null, incotermPlace: null });
  });

  it("18. DAP sets version 2020 server-side", () => {
    const result = form({ incoterm: "DAP", incotermPlace: " Kyiv, Ukraine " });
    expect(result.data).toMatchObject({ incoterm: "DAP", incotermVersion: 2020, incotermPlace: "Kyiv, Ukraine" });
  });

  it("19. Incoterm without a place is rejected", () => {
    expect(codes(form({ incoterm: "DAP", incotermPlace: "   " }))).toEqual(["incotermPlaceRequired"]);
  });

  it("unknown Incoterm code is rejected", () => {
    expect(codes(form({ incoterm: "DAT", incotermPlace: "Kyiv" }))).toContain("invalidIncoterm");
  });

  it("20. lead time 0 is accepted (not null)", () => {
    expect(form({ defaultLeadTimeDays: "0" }).data?.defaultLeadTimeDays).toBe(0);
  });

  it("21. negative / non-integer lead time is rejected", () => {
    expect(codes(form({ defaultLeadTimeDays: "-1" }))).toEqual(["invalidDays"]);
    expect(codes(form({ defaultLeadTimeDays: "2.5" }))).toEqual(["invalidDays"]);
  });

  it("22. whitespace optional fields → null; number trimmed", () => {
    const result = form({ agreementNumber: "  DK-1  ", notes: "   ", paymentTermsNote: "  ", defaultLeadTimeDays: "  " });
    expect(result.data).toMatchObject({
      agreementNumber: "DK-1",
      notes: null,
      paymentTermsNote: null,
      defaultLeadTimeDays: null,
    });
  });
});

describe("createSupplierAgreement service", () => {
  const terms = () => {
    const parsed = form({ incoterm: "DAP", incotermPlace: "Kyiv, Ukraine", defaultLeadTimeDays: "7" });
    if (!parsed.success) throw new Error("fixture must be valid");
    return parsed.data;
  };

  it("23–26. creates a DRAFT with the route supplier, the current user and normalized fields", async () => {
    const result = await createSupplierAgreement(USER_ID, SUPPLIER_ID, terms());

    expect(result).toEqual({ ok: true, agreementId: NEW_AGREEMENT_ID });
    expect(m.tx.supplierAgreement.create).toHaveBeenCalledTimes(1);
    expect(m.tx.supplierAgreement.create.mock.calls[0][0].data).toEqual({
      supplierId: SUPPLIER_ID,
      agreementNumber: "DK-2026-17",
      status: "DRAFT",
      validFrom: new Date("2026-01-01T00:00:00Z"),
      validTo: new Date("2026-12-31T00:00:00Z"),
      currency: "EUR",
      prepaymentPercent: null,
      balanceDueDays: null,
      balanceDueBasis: null,
      paymentTermsNote: null,
      incoterm: "DAP",
      incotermVersion: 2020,
      incotermPlace: "Kyiv, Ukraine",
      defaultLeadTimeDays: 7,
      notes: null,
      createdById: USER_ID,
    });
  });

  it("27. no agreement items or price tiers are created", async () => {
    await createSupplierAgreement(USER_ID, SUPPLIER_ID, terms());
    expect(m.tx.supplierAgreementItem.create).not.toHaveBeenCalled();
    expect(m.tx.supplierAgreementItem.createMany).not.toHaveBeenCalled();
    expect(m.tx.supplierAgreementPriceTier.create).not.toHaveBeenCalled();
    expect(m.tx.supplierAgreementPriceTier.createMany).not.toHaveBeenCalled();
  });

  it("28. writes AuditLog CREATE with the agreed metadata (no notes)", async () => {
    await createSupplierAgreement(USER_ID, SUPPLIER_ID, terms());
    expect(m.tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: USER_ID,
        entityType: "SupplierAgreement",
        entityId: NEW_AGREEMENT_ID,
        action: "CREATE",
        metadata: {
          supplierId: SUPPLIER_ID,
          agreementNumber: "DK-2026-17",
          currency: "EUR",
          validFrom: "2026-01-01",
          validTo: "2026-12-31",
        },
      },
    });
  });

  it("29. agreement and audit are written through the same transaction client", async () => {
    await createSupplierAgreement(USER_ID, SUPPLIER_ID, terms());
    expect(m.transaction).toHaveBeenCalledTimes(1);
    expect(m.rootAgreementCreate).not.toHaveBeenCalled();
    expect(m.rootAuditCreate).not.toHaveBeenCalled();
  });

  it("29b. an audit failure fails the whole create (transaction rejects)", async () => {
    m.tx.auditLog.create.mockRejectedValue(new Error("audit down"));
    expect(await createSupplierAgreement(USER_ID, SUPPLIER_ID, terms())).toEqual({ ok: false, error: "CREATE_FAILED" });
  });

  it("30. invalid terms create nothing", async () => {
    const result = await createSupplierAgreement(USER_ID, SUPPLIER_ID, { ...terms(), currency: "USD" as "EUR" });
    expect(result).toEqual({ ok: false, error: "CREATE_FAILED" });
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("31. missing supplier creates nothing", async () => {
    m.tx.supplier.findUnique.mockResolvedValue(null);
    expect(await createSupplierAgreement(USER_ID, SUPPLIER_ID, terms())).toEqual({
      ok: false,
      error: "SUPPLIER_NOT_FOUND",
    });
    expect(m.tx.supplierAgreement.create).not.toHaveBeenCalled();
    expect(m.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("33. P2002 on the (supplierId, agreementNumber) index → DUPLICATE_AGREEMENT_NUMBER", async () => {
    const byIndex = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "7.10.0",
      meta: {
        modelName: "SupplierAgreement",
        driverAdapterError: {
          cause: { constraint: { index: "supplier_agreements_supplierId_agreementNumber_key" } },
        },
      },
    });
    m.tx.supplierAgreement.create.mockRejectedValue(byIndex);
    expect(await createSupplierAgreement(USER_ID, SUPPLIER_ID, terms())).toEqual({
      ok: false,
      error: "DUPLICATE_AGREEMENT_NUMBER",
    });

    const byFields = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "7.10.0",
      meta: { driverAdapterError: { cause: { constraint: { fields: ['"supplierId"', '"agreementNumber"'] } } } },
    });
    m.tx.supplierAgreement.create.mockRejectedValue(byFields);
    expect(await createSupplierAgreement(USER_ID, SUPPLIER_ID, terms())).toEqual({
      ok: false,
      error: "DUPLICATE_AGREEMENT_NUMBER",
    });
  });

  it("34. a P2002 on another constraint or any other error is CREATE_FAILED, never raw", async () => {
    const otherUnique = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "7.10.0",
      meta: { driverAdapterError: { cause: { constraint: { index: "some_other_key" } } } },
    });
    m.tx.supplierAgreement.create.mockRejectedValue(otherUnique);
    expect(await createSupplierAgreement(USER_ID, SUPPLIER_ID, terms())).toEqual({ ok: false, error: "CREATE_FAILED" });

    m.tx.supplierAgreement.create.mockRejectedValue(new Error("connection reset: host=db.internal"));
    expect(await createSupplierAgreement(USER_ID, SUPPLIER_ID, terms())).toEqual({ ok: false, error: "CREATE_FAILED" });
  });
});

describe("createSupplierAgreementAction", () => {
  it("32. missing suppliers.update creates nothing", async () => {
    m.requirePermission.mockRejectedValue(new Error("Forbidden"));
    expect(await createSupplierAgreementAction(SUPPLIER_ID, minimalForm)).toEqual({ error: t.createGenericError });
    expect(m.requirePermission).toHaveBeenCalledWith("suppliers.update");
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("30b. invalid form creates nothing", async () => {
    expect(await createSupplierAgreementAction(SUPPLIER_ID, { ...minimalForm, currency: "USD" })).toEqual({
      error: t.invalidForm,
    });
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("31b. unknown supplier → safe localized error", async () => {
    m.tx.supplier.findUnique.mockResolvedValue(null);
    expect(await createSupplierAgreementAction(OTHER_SUPPLIER_ID, minimalForm)).toEqual({ error: t.supplierNotFound });
  });

  it("33b. duplicate number → field error on agreementNumber", async () => {
    m.tx.supplierAgreement.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.10.0",
        meta: { driverAdapterError: { cause: { constraint: { index: "supplier_agreements_supplierId_agreementNumber_key" } } } },
      }),
    );
    expect(await createSupplierAgreementAction(SUPPLIER_ID, minimalForm)).toEqual({
      error: t.duplicateAgreementNumber,
      field: "agreementNumber",
    });
    expect(m.revalidatePath).not.toHaveBeenCalled();
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it("35. success revalidates the list and redirects to the new agreement card", async () => {
    await expect(createSupplierAgreementAction(SUPPLIER_ID, minimalForm)).rejects.toThrow(
      `REDIRECT:/procurement/suppliers/${SUPPLIER_ID}/agreements/${NEW_AGREEMENT_ID}`,
    );
    expect(m.revalidatePath).toHaveBeenCalledWith(`/procurement/suppliers/${SUPPLIER_ID}/agreements`);
  });

  it("security: status / supplierId / createdById / incotermVersion from the client are ignored", async () => {
    const tampered = {
      ...minimalForm,
      incoterm: "DAP",
      incotermPlace: "Kyiv",
      status: "ACTIVE",
      supplierId: OTHER_SUPPLIER_ID,
      createdById: "attacker",
      incotermVersion: "2010",
    } as unknown as SupplierAgreementFormValues;

    await expect(createSupplierAgreementAction(SUPPLIER_ID, tampered)).rejects.toThrow("REDIRECT:");

    expect(m.tx.supplier.findUnique).toHaveBeenCalledWith({ where: { id: SUPPLIER_ID }, select: { id: true } });
    const data = m.tx.supplierAgreement.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      supplierId: SUPPLIER_ID,
      status: "DRAFT",
      createdById: USER_ID,
      incoterm: "DAP",
      incotermVersion: 2020,
    });
  });

  it("security: the parsed form output carries no server-owned keys", () => {
    const result = supplierAgreementFormSchema.safeParse({
      ...minimalForm,
      status: "ACTIVE",
      supplierId: OTHER_SUPPLIER_ID,
      createdById: "attacker",
    });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("status");
    expect(result.data).not.toHaveProperty("supplierId");
    expect(result.data).not.toHaveProperty("createdById");
  });
});
