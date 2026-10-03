/** Status filter values in display order. "all" is the default and never written to the URL. */
export const PRODUCT_STATUS_FILTERS = ["all", "active", "inactive"] as const;

export type ProductStatusFilter = (typeof PRODUCT_STATUS_FILTERS)[number];

export type ProductListQuery = {
  q: string;
  status: ProductStatusFilter;
  /** "" = all categories; otherwise an exact stored category value. */
  category: string;
  page?: number;
};

export const PRODUCT_LIST_BASE_PATH = "/products";

/** Only exact filter values are accepted from the URL; anything else = all. */
export function parseProductStatusFilter(value: string | undefined): ProductStatusFilter {
  return value && (PRODUCT_STATUS_FILTERS as readonly string[]).includes(value)
    ? (value as ProductStatusFilter)
    : "all";
}

/** Maps the URL filter onto Product.isActive (undefined = no filter). */
export function productStatusToIsActive(status: ProductStatusFilter): boolean | undefined {
  return status === "all" ? undefined : status === "active";
}

/**
 * Single URL builder for the product catalog, shared by filters, search
 * reset, pagination and the page's normalization redirects so they always
 * carry the same parameters. Omitting `page` (any filter/search change)
 * always lands on page 1.
 */
export function buildProductListHref({ q, status, category, page }: ProductListQuery): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status !== "all") params.set("status", status);
  if (category) params.set("category", category);
  if (page && page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${PRODUCT_LIST_BASE_PATH}?${qs}` : PRODUCT_LIST_BASE_PATH;
}
