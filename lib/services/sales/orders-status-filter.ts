import { SalesOrderStatus } from "@/lib/generated/prisma/client";
import type { OrdersStatusFilter } from "@/components/sales/orders-filters";
import type { ListSalesOrdersOptions } from "@/lib/services/sales/list-sales-orders";

/**
 * "Completed" tab = orders that are finished as business: shipped (the
 * last status the lifecycle reaches today) or completed. CANCELLED has
 * its own tab and is never part of this set.
 */
export const COMPLETED_SALES_ORDER_STATUSES: SalesOrderStatus[] = [
  SalesOrderStatus.SHIPPED,
  SalesOrderStatus.COMPLETED,
];

/** Maps the /sales/orders ?status= tab to listSalesOrders options. */
export function statusFilterToOptions(
  filter: OrdersStatusFilter,
): Pick<ListSalesOrdersOptions, "onlyActive" | "status" | "statuses"> {
  switch (filter) {
    case "active":
      return { onlyActive: true };
    case "completed":
      return { statuses: COMPLETED_SALES_ORDER_STATUSES };
    case "cancelled":
      return { status: SalesOrderStatus.CANCELLED };
    default:
      return {};
  }
}
