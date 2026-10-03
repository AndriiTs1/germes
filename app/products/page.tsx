import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ProductFilters } from "@/components/products/product-filters";
import { ProductList } from "@/components/products/product-list";
import {
  buildProductListHref,
  parseProductStatusFilter,
  productStatusToIsActive,
} from "@/components/products/product-list-url";
import { ProductPagination } from "@/components/products/product-pagination";
import { INTL_LOCALE_MAP } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { pluralize } from "@/lib/i18n/pluralize";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getProductStockSummaries } from "@/lib/services/products/get-product-stock-summaries";
import { listProductCategories, listProducts } from "@/lib/services/products/list-products";

const PRODUCTS_READ_PERMISSION = "products.read";
const INVENTORY_STOCK_READ_PERMISSION = "inventory.stock.read";

/**
 * Read-only Product master catalog — every Product record, independent of
 * stock, shared by Sales, Procurement and Warehouse rather than owned by one
 * of them. Gated on products.read. Stock columns are an extra layer gated on
 * the existing inventory.stock.read: without it the stock service is never
 * called, so no quantity reaches the page at all.
 *
 * Search, category, status and page all live in the URL and are resolved on
 * the server; only the current page of products is loaded.
 */
export default async function ProductsPage(props: PageProps<"/products">) {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    // Same reasoning as every other workspace route: any failure here is
    // safest resolved by "/", which re-derives the correct destination.
    user = await requirePermission(PRODUCTS_READ_PERMISSION);
  } catch {
    redirect("/");
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);
  const canReadStock = permissionCodes.includes(INVENTORY_STOCK_READ_PERMISSION);

  const locale = await getCurrentLocale();
  const dictionary = getDictionary(locale);
  const t = dictionary.products;

  const searchParams = await props.searchParams;
  const rawQ = typeof searchParams?.q === "string" ? searchParams.q : undefined;
  const q = rawQ?.trim() ?? "";
  const status = parseProductStatusFilter(typeof searchParams?.status === "string" ? searchParams.status : undefined);
  const rawCategory = typeof searchParams?.category === "string" ? searchParams.category : "";
  const rawPage = typeof searchParams?.page === "string" ? Number(searchParams.page) : 1;
  const requestedPage = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  const storedCategories = await listProductCategories();

  // Category must be an exact stored value; an unknown value is dropped
  // (redirect) rather than trusted.
  if (rawCategory && !storedCategories.includes(rawCategory)) {
    redirect(buildProductListHref({ q, status, category: "" }));
  }
  const category = rawCategory;

  // Normalize the search in the URL: "   pork   " → ?q=pork, and an empty
  // q= is dropped. Status/category are kept; a new search lands on page 1.
  if (rawQ !== undefined && (rawQ !== q || q === "")) {
    redirect(buildProductListHref({ q, status, category }));
  }

  const result = await listProducts({
    search: q || undefined,
    category: category || undefined,
    isActive: productStatusToIsActive(status),
    page: requestedPage,
  });

  if (requestedPage > result.pageCount) {
    redirect(buildProductListHref({ q, status, category, page: result.pageCount }));
  }

  const stock = canReadStock ? await getProductStockSummaries(result.items.map((product) => product.id)) : null;

  const collator = new Intl.Collator(INTL_LOCALE_MAP[locale]);
  const categories = [...storedCategories].sort((a, b) => collator.compare(a, b));

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath="/products"
      dictionary={dictionary}
      showPeriodControl={false}
      // The catalog has its own search; the global header search isn't wired for it.
      showGlobalSearch={false}
    >
      <div className="pb-4">
        <h1 className="text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
          {t.title}
        </h1>
      </div>

      <section aria-label={t.title} className="flex flex-col gap-4">
        <ProductFilters
          q={q}
          status={status}
          category={category}
          categories={categories}
          resultCount={pluralize(locale, result.totalCount, t.count)}
          dictionary={dictionary}
        />
        <ProductList
          products={result.items}
          stock={stock}
          hasAnyProducts={result.allCount > 0}
          clearFiltersHref={buildProductListHref({ q: "", status: "all", category: "" })}
          locale={locale}
          dictionary={dictionary}
        />
        <ProductPagination
          page={result.page}
          pageCount={result.pageCount}
          query={{ q, status, category }}
          dictionary={dictionary}
        />
      </section>
    </DashboardShell>
  );
}
