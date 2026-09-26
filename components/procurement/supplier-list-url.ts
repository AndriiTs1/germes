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

/**
 * Single URL builder for the /procurement supplier list, shared by filters,
 * search reset and pagination so they always carry the same parameters.
 * Omitting `page` (any filter/search change) always lands on page 1.
 */
export function buildSupplierListHref({ q, status, country, page }: SupplierListQuery): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status !== "all") params.set("status", status);
  if (country) params.set("country", country);
  if (page && page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/procurement?${qs}` : "/procurement";
}
