import type { Dictionary } from "@/lib/i18n/get-dictionary";

/**
 * Colors are locale-independent — kept as a static map exactly as before.
 * Every key is an exact SalesOrderStatus enum value — no invented labels.
 */
export const ORDER_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  CONFIRMED: "bg-blue-50 text-blue-600",
  PROCESSING: "bg-amber-50 text-amber-600",
  READY: "bg-violet-50 text-violet-600",
  SHIPPED: "bg-teal-50 text-teal-600",
  COMPLETED: "bg-emerald-50 text-emerald-600",
  CANCELLED: "bg-rose-50 text-rose-600",
};

/**
 * Presentation-only label lookup, driven by the resolved dictionary's
 * status.order map (see lib/i18n/dictionaries/en.ts). Takes just that
 * narrow sub-map — not the whole Dictionary — so Client Components only
 * need to pass the few labels they actually render. The underlying
 * SalesOrderStatus enum value is never changed; only its displayed label
 * varies by locale. Falls back to the raw status string for any value the
 * dictionary doesn't recognize (never throws).
 */
export function getOrderStatusLabel(labels: Dictionary["status"]["order"], status: string): string {
  return (labels as Record<string, string>)[status] ?? status;
}
