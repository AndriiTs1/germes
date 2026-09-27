/** Every PurchaseOrderStatus enum value, in display order. Kept in sync with prisma/schema.prisma. */
export const PURCHASE_ORDER_STATUSES = ["DRAFT", "CONFIRMED", "CLOSED", "CANCELLED"] as const;

export type PurchaseOrderStatusValue = (typeof PURCHASE_ORDER_STATUSES)[number];
export type PurchaseOrderStatusFilter = "all" | PurchaseOrderStatusValue;

export type PurchaseOrderListQuery = {
  q: string;
  status: PurchaseOrderStatusFilter;
  page?: number;
};

/**
 * Single URL builder for /procurement/orders, shared by filters, search
 * reset and pagination (same approach as supplier-list-url.ts). Only q,
 * status and page exist; omitting `page` (any filter/search change) always
 * lands on page 1.
 */
export function buildPurchaseOrderListHref({ q, status, page }: PurchaseOrderListQuery): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status !== "all") params.set("status", status);
  if (page && page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/procurement/orders?${qs}` : "/procurement/orders";
}
