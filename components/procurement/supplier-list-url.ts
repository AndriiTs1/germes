/** Every SupplierStatus enum value, in display order. Kept in sync with prisma/schema.prisma. */
export const SUPPLIER_STATUSES = ["ACTIVE", "POTENTIAL", "IN_PROGRESS", "INACTIVE", "BLOCKED"] as const;

export type SupplierStatusValue = (typeof SUPPLIER_STATUSES)[number];
export type SupplierStatusFilter = "all" | SupplierStatusValue;

export type SupplierListQuery = {
  q: string;
  status: SupplierStatusFilter;
  /** "" = all countries; otherwise an exact stored value or the "not specified" sentinel. */
  country: string;
  page?: number;
};

/** Canonical Supplier Directory route. Every generated supplier-list URL (and redirect) lives under it. */
export const SUPPLIER_LIST_BASE_PATH = "/procurement/suppliers";

/**
 * Single URL builder for the supplier list, shared by filters, search
 * reset, pagination and the pages' normalization redirects so they always
 * carry the same parameters. Always targets the canonical
 * SUPPLIER_LIST_BASE_PATH — including when the directory is still rendered
 * on /procurement during the transition to the real Procurement overview.
 * Omitting `page` (any filter/search change) always lands on page 1.
 */
export function buildSupplierListHref({ q, status, country, page }: SupplierListQuery): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status !== "all") params.set("status", status);
  if (country) params.set("country", country);
  if (page && page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${SUPPLIER_LIST_BASE_PATH}?${qs}` : SUPPLIER_LIST_BASE_PATH;
}
