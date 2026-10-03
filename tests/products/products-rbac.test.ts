import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** code → roles, parsed from a permission catalog source (seed: `roles`, sync script: `roleCodes`). */
function parseCatalog(file: string, rolesKey: "roles" | "roleCodes"): Map<string, string[]> {
  const source = readFileSync(path.join(ROOT, file), "utf8");
  const pattern = new RegExp(`code:\\s*"([a-z_.]+)",[\\s\\S]*?${rolesKey}:\\s*\\[([^\\]]*)\\]`, "g");
  const catalog = new Map<string, string[]>();
  for (const match of source.matchAll(pattern)) {
    catalog.set(match[1], [...match[2].matchAll(/"([A-Z]+)"/g)].map((role) => role[1]));
  }
  return catalog;
}

const seedCatalog = parseCatalog("prisma/seed.ts", "roles");
const syncCatalog = parseCatalog("scripts/sync-workspace-permissions.ts", "roleCodes");

/** Permission codes a role really holds according to the seed catalog. */
const permissionsOf = (role: string) =>
  [...seedCatalog.entries()].filter(([, roles]) => roles.includes(role)).map(([code]) => code);

const m = vi.hoisted(() => ({
  codes: [] as string[],
  listProducts: vi.fn(),
  listProductCategories: vi.fn(),
  getProductStockSummaries: vi.fn(),
}));

class RedirectError extends Error {
  constructor(public readonly url: string) {
    super(`redirect:${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
  useRouter: () => ({ push: () => {} }),
}));
vi.mock("@/lib/permissions/require-permission", () => ({
  requirePermission: async (code: string) => {
    if (!m.codes.includes(code)) throw new Error("Forbidden");
    return { id: "user-1" };
  },
}));
vi.mock("@/lib/permissions/get-current-user-permissions", () => ({
  getPermissionCodesForUser: async () => m.codes,
}));
vi.mock("@/lib/i18n/locale", () => ({ getCurrentLocale: async () => "en" }));
vi.mock("@/components/dashboard/dashboard-shell", () => ({
  DashboardShell: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/products/product-category-select", () => ({ ProductCategorySelect: () => null }));
vi.mock("@/lib/services/products/list-products", () => ({
  PRODUCT_PAGE_SIZE: 50,
  listProducts: m.listProducts,
  listProductCategories: m.listProductCategories,
}));
vi.mock("@/lib/services/products/get-product-stock-summaries", () => ({
  getProductStockSummaries: m.getProductStockSummaries,
}));

import ProductsPage from "@/app/products/page";
import { filterNavSections, navSections } from "@/components/dashboard/nav-items";
import { getNavigationProfile } from "@/components/dashboard/navigation-profile";

const PRODUCT = { id: "p1", sku: "PORK-001", name: "Pork shoulder", category: "Pork", isActive: true };

async function openPage(searchParams: Record<string, string> = {}) {
  const page = await ProductsPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(searchParams),
  } as Parameters<typeof ProductsPage>[0]);
  return renderToStaticMarkup(page);
}

async function openAs(role: string) {
  m.codes = permissionsOf(role);
  try {
    return { html: await openPage(), redirectedTo: null };
  } catch (error) {
    if (error instanceof RedirectError) return { html: "", redirectedTo: error.url };
    throw error;
  }
}

function navHrefs(role: string) {
  const profile = getNavigationProfile({ roles: [{ role: { code: role } }] } as Parameters<typeof getNavigationProfile>[0]);
  return filterNavSections(navSections, permissionsOf(role), "/products", profile).flatMap((section) =>
    section.items.map((item) => item.href),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  m.listProducts.mockResolvedValue({ items: [PRODUCT], totalCount: 1, allCount: 1, page: 1, pageCount: 1 });
  m.listProductCategories.mockResolvedValue(["Pork"]);
  m.getProductStockSummaries.mockResolvedValue({
    p1: { onHandKg: "120.5", notSellableKg: "0", reservedKg: "20", availableKg: "100.5" },
  });
});

describe("products.read permission definition", () => {
  it("is granted to exactly OWNER, SALES, PROCUREMENT and WAREHOUSE in the seed catalog", () => {
    expect(seedCatalog.get("products.read")).toEqual(["OWNER", "SALES", "PROCUREMENT", "WAREHOUSE"]);
  });

  it("the permission sync allow-list matches the seed exactly", () => {
    expect(syncCatalog.get("products.read")).toEqual(seedCatalog.get("products.read"));
  });

  it("inventory.stock.read is unchanged (not widened by the catalog)", () => {
    expect(seedCatalog.get("inventory.stock.read")).toEqual(["OWNER", "ADMIN", "SALES", "PROCUREMENT", "WAREHOUSE", "ACCOUNTING"]);
  });

  it("no product write permission exists yet (catalog is read-only)", () => {
    for (const code of ["products.create", "products.update", "products.delete"]) {
      expect(seedCatalog.has(code)).toBe(false);
    }
  });
});

describe("/products access by role", () => {
  it.each(["OWNER", "SALES", "PROCUREMENT", "WAREHOUSE"])("%s can open the catalog", async (role) => {
    const { html, redirectedTo } = await openAs(role);
    expect(redirectedTo).toBeNull();
    expect(html).toContain("PORK-001");
    expect(html).toContain("Pork shoulder");
  });

  it.each(["ACCOUNTING", "ADMIN", "SUPPORT"])("%s cannot open the catalog (redirected to /)", async (role) => {
    const { redirectedTo } = await openAs(role);
    expect(redirectedTo).toBe("/");
    expect(m.listProducts).not.toHaveBeenCalled();
    expect(m.getProductStockSummaries).not.toHaveBeenCalled();
  });
});

describe("navigation", () => {
  it.each(["OWNER", "SALES", "PROCUREMENT", "WAREHOUSE"])("%s sees Products in the menu", (role) => {
    expect(navHrefs(role)).toContain("/products");
  });

  it.each(["ACCOUNTING", "ADMIN", "SUPPORT"])("%s does not see Products in the menu", (role) => {
    expect(navHrefs(role)).not.toContain("/products");
  });

  it("Products sits in its own shared catalog section, not under sell/buy/workspace", () => {
    const section = navSections.find((s) => s.items.some((item) => item.href === "/products"));
    expect(section?.labelKey).toBe("catalog");
    expect(section?.items.map((item) => item.requiredPermission)).toEqual(["products.read"]);
  });
});

describe("stock columns require inventory.stock.read", () => {
  it("with inventory.stock.read: stock is loaded for the current page only and rendered in kg", async () => {
    m.codes = ["products.read", "inventory.stock.read"];
    const html = await openPage();
    expect(m.getProductStockSummaries).toHaveBeenCalledTimes(1);
    expect(m.getProductStockSummaries).toHaveBeenCalledWith(["p1"]);
    expect(html).toContain("On hand, kg");
    expect(html).toContain("Available, kg");
    expect(html).toContain("100.5");
  });

  it("products.read alone: the stock service is never called and no quantity is rendered", async () => {
    m.codes = ["products.read"];
    const html = await openPage();
    expect(m.getProductStockSummaries).not.toHaveBeenCalled();
    expect(html).toContain("PORK-001");
    expect(html).not.toContain("On hand");
    expect(html).not.toContain("Reserved");
    expect(html).not.toContain("Available");
    expect(html).not.toContain("120.5");
    expect(html).not.toContain("100.5");
  });
});

describe("URL handling", () => {
  it("passes search, category, status and page to the server service", async () => {
    m.codes = ["products.read"];
    m.listProducts.mockResolvedValue({ items: [PRODUCT], totalCount: 120, allCount: 120, page: 2, pageCount: 3 });
    await openPage({ q: "pork", category: "Pork", status: "inactive", page: "2" });
    expect(m.listProducts).toHaveBeenCalledWith({ search: "pork", category: "Pork", isActive: false, page: 2 });
  });

  it("defaults to all statuses (no isActive filter) and page 1", async () => {
    m.codes = ["products.read"];
    await openPage();
    expect(m.listProducts).toHaveBeenCalledWith({ search: undefined, category: undefined, isActive: undefined, page: 1 });
  });

  it("drops an unknown category instead of trusting it", async () => {
    m.codes = ["products.read"];
    await expect(openPage({ category: "Nope", q: "x" })).rejects.toMatchObject({ url: "/products?q=x" });
  });

  it("a page beyond the last one redirects to the last page", async () => {
    m.codes = ["products.read"];
    m.listProducts.mockResolvedValue({ items: [], totalCount: 42, allCount: 42, page: 5, pageCount: 1 });
    await expect(openPage({ page: "5" })).rejects.toMatchObject({ url: "/products" });
  });
});
