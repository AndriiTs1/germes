import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/lib/generated/prisma/client";

// The real role → permission grants (prisma/seed.ts, identical to the DB),
// limited to the codes the search and its target pages look at.
const PERMISSIONS: Record<string, string[]> = {
  OWNER: ["finance.dashboard.read", "customers.read", "sales.orders.read", "procurement.overview.read", "suppliers.read"],
  ACCOUNTING: ["finance.dashboard.read", "customers.read", "sales.orders.read", "suppliers.read"],
  ADMIN: ["finance.dashboard.read", "customers.read", "sales.orders.read", "procurement.overview.read", "suppliers.read"],
  SALES: ["customers.read", "sales.orders.read"],
};

const session = vi.hoisted(() => ({ role: "OWNER", userId: "u-owner" }));

const db = vi.hoisted(() => ({
  customerFindMany: vi.fn(),
  supplierFindMany: vi.fn(),
  salesOrderFindMany: vi.fn(),
  receivableFindMany: vi.fn(),
  payableFindMany: vi.fn(),
}));

vi.mock("@/lib/permissions/require-permission", () => ({
  requirePermission: async (code: string) => {
    if (!PERMISSIONS[session.role].includes(code)) throw new Error("Forbidden");
    return { id: session.userId, roles: [{ role: { code: session.role } }] };
  },
}));
vi.mock("@/lib/permissions/get-current-user-permissions", () => ({
  getPermissionCodesForUser: async () => PERMISSIONS[session.role],
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    customer: { findMany: db.customerFindMany },
    supplier: { findMany: db.supplierFindMany },
    salesOrder: { findMany: db.salesOrderFindMany },
    receivable: { findMany: db.receivableFindMany },
    payable: { findMany: db.payableFindMany },
  },
}));

import { GET } from "@/app/api/finance/search/route";
import { customerResultHref, orderResultHref, supplierResultHref } from "@/lib/services/finance/search-result-links";

type SearchBody = {
  customers: { id: string; name: string; href: string | null; balances: unknown[] }[];
  suppliers: { id: string; name: string; href: string | null; balances: unknown[] }[];
  orders: { id: string; orderNumber: string; customerName: string; href: string | null; balances: unknown[] }[];
};

async function search(role: string, q = "ТОВ", userId = `u-${role.toLowerCase()}`) {
  session.role = role;
  session.userId = userId;
  const response = await GET(new Request(`http://localhost/api/finance/search?q=${encodeURIComponent(q)}`));
  return { status: response.status, body: (await response.json()) as SearchBody };
}

const hrefs = (body: SearchBody) => ({
  customers: Object.fromEntries(body.customers.map((c) => [c.id, c.href])),
  suppliers: Object.fromEntries(body.suppliers.map((s) => [s.id, s.href])),
  orders: Object.fromEntries(body.orders.map((o) => [o.id, o.href])),
});

beforeEach(() => {
  vi.clearAllMocks();
  db.customerFindMany.mockResolvedValue([
    { id: "c-active", name: "Alpha ТОВ", responsibleId: "u-sales", isActive: true },
    { id: "c-inactive", name: "Beta ТОВ", responsibleId: "u-sales", isActive: false },
  ]);
  db.supplierFindMany.mockResolvedValue([{ id: "s-1", name: "Supplier ТОВ" }]);
  db.salesOrderFindMany.mockResolvedValue([
    { id: "o-1", orderNumber: "SO-2026-001", responsibleId: "u-sales", customer: { name: "Alpha ТОВ" } },
  ]);
  db.receivableFindMany.mockResolvedValue([
    {
      customerId: "c-active",
      salesOrderId: "o-1",
      amount: new Prisma.Decimal("100"),
      paidAmount: new Prisma.Decimal("0"),
      currency: "UAH",
      dueDate: null,
      status: "OPEN",
    },
  ]);
  db.payableFindMany.mockResolvedValue([]);
});

describe("finance search — result links follow the target page's real access", () => {
  it("OWNER keeps working links (inactive customers aside: their page is notFound for everyone)", async () => {
    const { status, body } = await search("OWNER");
    expect(status).toBe(200);
    expect(hrefs(body)).toEqual({
      customers: { "c-active": "/sales/customers/c-active", "c-inactive": null },
      suppliers: { "s-1": "/procurement/suppliers/s-1" },
      orders: { "o-1": "/sales/orders/o-1" },
    });
  });

  it("ACCOUNTING gets every result, but none as a link (own Sales scope, no procurement.overview.read)", async () => {
    const { body } = await search("ACCOUNTING");
    expect(hrefs(body)).toEqual({
      customers: { "c-active": null, "c-inactive": null },
      suppliers: { "s-1": null },
      orders: { "o-1": null },
    });
  });

  it("ADMIN: suppliers link, customers/orders of other managers do not (own Sales scope)", async () => {
    const { body } = await search("ADMIN");
    expect(hrefs(body)).toEqual({
      customers: { "c-active": null, "c-inactive": null },
      suppliers: { "s-1": "/procurement/suppliers/s-1" },
      orders: { "o-1": null },
    });
  });

  it("a result without href is still returned in full — names and balances unchanged", async () => {
    const owner = (await search("OWNER")).body;
    const accounting = (await search("ACCOUNTING")).body;
    const withoutHref = <T extends { href: string | null }>(rows: T[]) =>
      rows.map((row) => {
        const copy: Partial<T> = { ...row };
        delete copy.href;
        return copy;
      });
    const strip = (body: SearchBody) => ({
      customers: withoutHref(body.customers),
      suppliers: withoutHref(body.suppliers),
      orders: withoutHref(body.orders),
    });
    expect(strip(accounting)).toEqual(strip(owner));
    expect(accounting.customers.find((c) => c.id === "c-active")?.balances).toEqual([
      { currency: "UAH", outstandingAmount: "100", overdueAmount: "0" },
    ]);
  });

  it("short / empty query: empty groups, no database search (as before)", async () => {
    for (const q of ["", " ", "a"]) {
      const { status, body } = await search("OWNER", q);
      expect(status).toBe(200);
      expect(body).toEqual({ customers: [], suppliers: [], orders: [] });
    }
    expect(db.customerFindMany).not.toHaveBeenCalled();
  });

  it("without finance.dashboard.read → 403, nothing queried", async () => {
    const { status } = await search("SALES");
    expect(status).toBe(403);
    expect(db.customerFindMany).not.toHaveBeenCalled();
  });
});

describe("search-result-links helpers", () => {
  const own = (userId: string, permissionCodes: string[]) => ({ userId, readScope: "own" as const, permissionCodes });

  it("own scope links the viewer's own customers and orders only", () => {
    const viewer = own("u-sales", ["customers.read", "sales.orders.read"]);
    expect(customerResultHref(viewer, { id: "c", responsibleId: "u-sales", isActive: true })).toBe("/sales/customers/c");
    expect(customerResultHref(viewer, { id: "c", responsibleId: "u-other", isActive: true })).toBeNull();
    expect(customerResultHref(viewer, { id: "c", responsibleId: null, isActive: true })).toBeNull();
    expect(orderResultHref(viewer, { id: "o", responsibleId: "u-sales" })).toBe("/sales/orders/o");
    expect(orderResultHref(viewer, { id: "o", responsibleId: null })).toBeNull();
  });

  it("each link needs the target page's own permission", () => {
    const all = { userId: "u", readScope: "all" as const, permissionCodes: [] as string[] };
    expect(customerResultHref(all, { id: "c", responsibleId: null, isActive: true })).toBeNull();
    expect(orderResultHref(all, { id: "o", responsibleId: null })).toBeNull();
    expect(supplierResultHref(all, { id: "s" })).toBeNull();
    expect(supplierResultHref({ ...all, permissionCodes: ["suppliers.read"] }, { id: "s" })).toBeNull();
    expect(supplierResultHref({ ...all, permissionCodes: ["procurement.overview.read"] }, { id: "s" })).toBeNull();
  });
});
