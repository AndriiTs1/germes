import type { SalesReadScope } from "@/lib/services/sales/read-scope";

/**
 * Who is searching: resolved server-side from the session, never from the request.
 */
export type SearchLinkViewer = {
  userId: string;
  readScope: SalesReadScope;
  permissionCodes: string[];
};

/**
 * Finance search result links. A result is always listed, but only gets an
 * href when the viewer can actually open the target page — mirroring each
 * page's own gate exactly, so a link never ends in notFound() or
 * redirect("/"). These checks decide links only; the target pages keep
 * enforcing access themselves.
 */

/** /sales/customers/[id]: customers.read, then getSalesCustomerDetail (isActive + responsibleId in "own" scope). */
export function customerResultHref(
  viewer: SearchLinkViewer,
  customer: { id: string; responsibleId: string | null; isActive: boolean },
): string | null {
  if (!viewer.permissionCodes.includes("customers.read")) return null;
  if (!customer.isActive) return null;
  if (viewer.readScope !== "all" && customer.responsibleId !== viewer.userId) return null;
  return `/sales/customers/${customer.id}`;
}

/** /sales/orders/[id]: sales.orders.read, then getSalesOrderDetail (responsibleId in "own" scope). */
export function orderResultHref(
  viewer: SearchLinkViewer,
  order: { id: string; responsibleId: string | null },
): string | null {
  if (!viewer.permissionCodes.includes("sales.orders.read")) return null;
  if (viewer.readScope !== "all" && order.responsibleId !== viewer.userId) return null;
  return `/sales/orders/${order.id}`;
}

/** /procurement/suppliers/[id]: procurement.overview.read and suppliers.read. */
export function supplierResultHref(viewer: SearchLinkViewer, supplier: { id: string }): string | null {
  if (!viewer.permissionCodes.includes("procurement.overview.read")) return null;
  if (!viewer.permissionCodes.includes("suppliers.read")) return null;
  return `/procurement/suppliers/${supplier.id}`;
}
