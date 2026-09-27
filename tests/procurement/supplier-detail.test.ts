import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  requirePermission: vi.fn(),
  getPermissionCodesForUser: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: { supplier: { findUnique: m.findUnique } } }));
vi.mock("@/lib/permissions/require-permission", () => ({ requirePermission: m.requirePermission }));
vi.mock("@/lib/permissions/get-current-user-permissions", () => ({
  getPermissionCodesForUser: m.getPermissionCodesForUser,
}));
vi.mock("@/lib/i18n/locale", () => ({ getCurrentLocale: async () => "uk" }));
vi.mock("next/navigation", () => ({ redirect: m.redirect, notFound: m.notFound }));
// The shell/overview are presentation only; the page's own access and
// not-found logic is what these tests exercise.
vi.mock("@/components/dashboard/dashboard-shell", () => ({ DashboardShell: () => null }));
vi.mock("@/components/procurement/supplier-detail-overview", () => ({ SupplierDetailOverview: () => null }));

import SupplierDetailPage from "@/app/procurement/suppliers/[id]/page";
import { getSupplierDetail } from "@/lib/services/procurement/get-supplier-detail";

const SUPPLIER_ID = "11111111-1111-4111-8111-111111111111";

const fullRow = {
  id: SUPPLIER_ID,
  code: "SUP-005",
  name: "ESS-FOOD A/S",
  status: "ACTIVE",
  legalName: "ESS-FOOD Amba",
  taxId: "DK12345678",
  country: "Данія",
  contactPerson: "Jens Hansen",
  phone: "+45 00 00 00 00",
  email: "sales@example.com",
  address: "Copenhagen",
  notes: "Frozen pork",
  responsible: { id: "user-1", name: "Олена", email: "olena@example.com" },
};

const sparseRow = {
  id: SUPPLIER_ID,
  code: "SUP-001",
  name: "Baltic Meat Supply",
  status: "POTENTIAL",
  legalName: null,
  taxId: "",
  country: null,
  contactPerson: "   ",
  phone: null,
  email: null,
  address: null,
  notes: null,
  responsible: null,
};

function pageProps(id = SUPPLIER_ID) {
  return { params: Promise.resolve({ id }), searchParams: Promise.resolve({}) } as unknown as PageProps<"/procurement/suppliers/[id]">;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.requirePermission.mockResolvedValue({ id: "user-1" });
  m.getPermissionCodesForUser.mockResolvedValue(["procurement.overview.read", "suppliers.read"]);
});

describe("getSupplierDetail", () => {
  it("returns the detail of an existing supplier", async () => {
    m.findUnique.mockResolvedValue(fullRow);

    expect(await getSupplierDetail(SUPPLIER_ID)).toEqual(fullRow);
    const query = m.findUnique.mock.calls[0][0];
    expect(query.where).toEqual({ id: SUPPLIER_ID });
  });

  it("returns null for a supplier that doesn't exist", async () => {
    m.findUnique.mockResolvedValue(null);
    expect(await getSupplierDetail("no-such-id")).toBeNull();
  });

  it("maps null and blank fields to null without failing", async () => {
    m.findUnique.mockResolvedValue(sparseRow);

    const detail = await getSupplierDetail(SUPPLIER_ID);

    expect(detail).toMatchObject({
      code: "SUP-001",
      name: "Baltic Meat Supply",
      status: "POTENTIAL",
      legalName: null,
      taxId: null,
      country: null,
      contactPerson: null,
      phone: null,
      email: null,
      address: null,
      notes: null,
      responsible: null,
    });
  });

  it("never reads paymentTermDays or other undefined commercial/CRM fields", async () => {
    m.findUnique.mockResolvedValue(fullRow);
    await getSupplierDetail(SUPPLIER_ID);

    const select = m.findUnique.mock.calls[0][0].select;
    for (const field of ["paymentTermDays", "rating", "lastContactAt", "nextActionAt", "purchaseOrders", "payables"]) {
      expect(select).not.toHaveProperty(field);
    }
  });
});

describe("/procurement/suppliers/[id] page access", () => {
  it("redirects to / without procurement.overview.read; supplier never read", async () => {
    m.requirePermission.mockRejectedValue(new Error("Forbidden"));

    await expect(SupplierDetailPage(pageProps())).rejects.toThrow("REDIRECT:/");
    expect(m.requirePermission).toHaveBeenCalledWith("procurement.overview.read");
    expect(m.findUnique).not.toHaveBeenCalled();
  });

  it("redirects to / without suppliers.read; supplier never read", async () => {
    m.getPermissionCodesForUser.mockResolvedValue(["procurement.overview.read"]);

    await expect(SupplierDetailPage(pageProps())).rejects.toThrow("REDIRECT:/");
    expect(m.findUnique).not.toHaveBeenCalled();
  });

  it("calls notFound() for an unknown supplier instead of rendering an empty card", async () => {
    m.findUnique.mockResolvedValue(null);

    await expect(SupplierDetailPage(pageProps("no-such-id"))).rejects.toThrow("NOT_FOUND");
    expect(m.notFound).toHaveBeenCalled();
  });

  it("renders for a user holding both permissions", async () => {
    m.findUnique.mockResolvedValue(sparseRow);

    await expect(SupplierDetailPage(pageProps())).resolves.toBeTruthy();
    expect(m.redirect).not.toHaveBeenCalled();
    expect(m.notFound).not.toHaveBeenCalled();
  });
});
