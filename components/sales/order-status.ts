/**
 * Presentation-only mapping, kept separate from the business status
 * definition (TERMINAL_SALES_ORDER_STATUSES lives in the service/domain
 * layer at lib/services/sales/config.ts). Every key is an exact
 * SalesOrderStatus enum value — no invented labels.
 */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  READY: "Ready",
  SHIPPED: "Shipped",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  CONFIRMED: "bg-blue-50 text-blue-600",
  PROCESSING: "bg-amber-50 text-amber-600",
  READY: "bg-violet-50 text-violet-600",
  SHIPPED: "bg-teal-50 text-teal-600",
  COMPLETED: "bg-emerald-50 text-emerald-600",
  CANCELLED: "bg-rose-50 text-rose-600",
};
