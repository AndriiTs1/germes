import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));
vi.mock("@/components/products/product-category-select", () => ({ ProductCategorySelect: () => null }));

import { filterNavSections, navSections } from "@/components/dashboard/nav-items";
import { ProductFilters } from "@/components/products/product-filters";
import { buildProductListHref, parseProductStatusFilter } from "@/components/products/product-list-url";
import { ProductList } from "@/components/products/product-list";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const ROOT = path.resolve(import.meta.dirname, "../..");

const PRODUCTS = [
  { id: "p1", sku: "PORK-001", name: "Шия свиняча", category: "Свинина", isActive: true },
  { id: "p2", sku: "BEEF-001", name: "Серце яловиче", category: null, isActive: false },
];
const STOCK = {
  p1: { onHandKg: "1250.5", notSellableKg: "0", reservedKg: "250", availableKg: "1000.5" },
  p2: { onHandKg: "0", notSellableKg: "0", reservedKg: "0", availableKg: "0" },
};

function renderList(locale: "uk" | "ru" | "en", stock: typeof STOCK | null) {
  return renderToStaticMarkup(
    ProductList({
      products: PRODUCTS,
      stock,
      hasAnyProducts: true,
      clearFiltersHref: "/products",
      locale,
      dictionary: getDictionary(locale),
    }),
  );
}

describe("ProductList", () => {
  it.each([
    ["uk", ["SKU", "Назва", "Категорія", "На складі, кг", "Резерв, кг", "Доступно, кг", "Статус", "Активний", "Неактивний"]],
    ["ru", ["SKU", "Название", "Категория", "На складе, кг", "Резерв, кг", "Доступно, кг", "Статус", "Активный", "Неактивный"]],
    ["en", ["SKU", "Name", "Category", "On hand, kg", "Reserved, kg", "Available, kg", "Status", "Active", "Inactive"]],
  ] as const)("%s: localized desktop columns and status badges", (locale, labels) => {
    const html = renderList(locale, STOCK);
    for (const label of labels) expect(html).toContain(label);
  });

  it("with stock: renders on hand / reserved / available in kg, zero rows included", () => {
    const html = renderList("uk", STOCK);
    expect(html).toContain("PORK-001");
    expect(html).toContain("BEEF-001"); // zero stock is still listed
    expect(html).toMatch(/1\s250,5/); // uk-formatted kg
    expect(html).toMatch(/1\s000,5/);
    expect(html).toContain("кг");
  });

  it("without stock: no stock column and no quantity is rendered", () => {
    const html = renderList("uk", null);
    expect(html).toContain("PORK-001");
    expect(html).toContain("Шия свиняча");
    for (const hidden of ["На складі", "Резерв", "Доступно", "1250", "1 250", "1000"]) expect(html).not.toContain(hidden);
  });

  it("mobile cards show SKU + name, category, the three stock values and status", () => {
    const html = renderList("en", STOCK);
    const mobile = html.slice(html.indexOf("md:hidden"));
    for (const text of ["PORK-001", "Шия свиняча", "Свинина", "On hand", "Reserved", "Available", "Active"]) {
      expect(mobile).toContain(text);
    }
    expect(mobile).not.toContain("<table");
  });

  it("compact tablet table (<lg): category folds under the name, short stock headers, kg on every value, status kept", () => {
    const html = renderList("uk", STOCK);
    const table = html.slice(0, html.indexOf("md:hidden"));
    // Category column exists only from lg; below it the name cell carries the category.
    expect(table).toMatch(/<th scope="col" class="[^"]*hidden lg:table-cell[^"]*">Категорія<\/th>/);
    expect(table).toMatch(/<p class="[^"]*lg:hidden">Свинина<\/p>/);
    // Short headers below lg, full "…, кг" headers from lg — no multi-line headers.
    expect(table).toContain('<span class="lg:hidden">На складі</span><span class="hidden lg:inline">На складі, кг</span>');
    expect(table).toContain('<span class="lg:hidden">Доступно</span><span class="hidden lg:inline">Доступно, кг</span>');
    expect(table).toMatch(/<tr class="[^"]*whitespace-nowrap[^"]*uppercase">/);
    // Below lg each stock value carries the unit itself (3 values × 2 rows).
    expect(table.match(/lg:hidden">кг<\/span>/g)).toHaveLength(6);
    // Status is never hidden at any table width.
    expect(table).toMatch(/<th scope="col" class="px-3 py-3 lg:px-4">Статус<\/th>/);
  });

  it("the status badge never shrinks next to a long name", () => {
    const html = renderList("en", STOCK);
    expect(html).toMatch(/class="shrink-0 rounded-full[^"]*">Active</);
    expect(html).toMatch(/class="shrink-0 rounded-full[^"]*">Inactive</);
  });

  it("a missing category is shown as a dash, never as empty", () => {
    expect(renderList("en", null)).toContain("BEEF-001 · —");
  });

  it("highlights a negative available value and explains non-sellable stock", () => {
    const html = renderList("uk", {
      ...STOCK,
      p1: { onHandKg: "100", notSellableKg: "40", reservedKg: "70", availableKg: "-10" },
    });
    expect(html).toContain("text-rose-600");
    expect(html).toContain("з них 40 кг недоступно до продажу");
  });

  it.each([
    ["uk", "Немає продуктів за цими фільтрами", "Продуктів ще немає"],
    ["ru", "Нет продуктов по этим фильтрам", "Продуктов пока нет"],
    ["en", "No products match the filters", "No products yet"],
  ] as const)("%s: two distinct empty states", (locale, noResults, noProducts) => {
    const dictionary = getDictionary(locale);
    const base = { products: [], stock: null, clearFiltersHref: "/products", locale, dictionary };
    expect(renderToStaticMarkup(ProductList({ ...base, hasAnyProducts: true }))).toContain(noResults);
    expect(renderToStaticMarkup(ProductList({ ...base, hasAnyProducts: false }))).toContain(noProducts);
  });

  it("is read-only: no create / edit / delete / deactivate controls and no detail links", () => {
    const html = renderList("en", STOCK);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("/products/");
  });
});

describe("ProductFilters", () => {
  it.each([
    ["uk", ["Усі", "Активні", "Неактивні", "Пошук за SKU або назвою"]],
    ["ru", ["Все", "Активные", "Неактивные", "Поиск по SKU или названию"]],
    ["en", ["All", "Active", "Inactive", "Search by SKU or name"]],
  ] as const)("%s: status chips and search", (locale, labels) => {
    const html = renderToStaticMarkup(
      ProductFilters({ q: "", status: "all", category: "", categories: ["Свинина"], resultCount: "42", dictionary: getDictionary(locale) }),
    );
    for (const label of labels) expect(html).toContain(label);
  });

  it("status chips keep search and category and reset the page", () => {
    const html = renderToStaticMarkup(
      ProductFilters({ q: "шия", status: "all", category: "Свинина", categories: ["Свинина"], resultCount: "1", dictionary: getDictionary("en") }),
    );
    expect(html).toContain(`href="${buildProductListHref({ q: "шия", status: "inactive", category: "Свинина" }).replace(/&/g, "&amp;")}"`);
    expect(html).toContain('name="category" value="Свинина"');
  });
});

describe("product list URL", () => {
  it("default (all statuses, page 1) is the bare path", () => {
    expect(buildProductListHref({ q: "", status: "all", category: "" })).toBe("/products");
  });

  it("encodes every filter and the page", () => {
    expect(buildProductListHref({ q: "pork", status: "active", category: "Свинина", page: 2 })).toBe(
      `/products?q=pork&status=active&category=${encodeURIComponent("Свинина")}&page=2`,
    );
  });

  it("unknown status values fall back to all", () => {
    expect(parseProductStatusFilter("deleted")).toBe("all");
    expect(parseProductStatusFilter("inactive")).toBe("inactive");
  });
});

describe("i18n", () => {
  it.each([
    ["uk", "Довідники", "Продукти"],
    ["ru", "Справочники", "Продукты"],
    ["en", "Directories", "Products"],
  ] as const)("%s: nav section and item labels", (locale, section, item) => {
    const dictionary = getDictionary(locale);
    expect(dictionary.nav.sections.catalog).toBe(section);
    expect(dictionary.nav.products).toBe(item);
    expect(dictionary.products.title).toBe(item);
  });

  it("the catalog section renders only for holders of products.read", () => {
    expect(filterNavSections(navSections, ["products.read"], "/products").map((s) => s.labelKey)).toContain("catalog");
    expect(filterNavSections(navSections, ["inventory.stock.read"], "/products").map((s) => s.labelKey)).not.toContain("catalog");
  });

  it("no hardcoded Cyrillic UI text in the new components or page", () => {
    for (const file of [
      "app/products/page.tsx",
      "components/products/product-list.tsx",
      "components/products/product-filters.tsx",
      "components/products/product-pagination.tsx",
      "components/products/product-category-select.tsx",
    ]) {
      expect(readFileSync(path.join(ROOT, file), "utf8"), file).not.toMatch(/[А-Яа-яЇїІіЄєҐґ]/);
    }
  });
});
