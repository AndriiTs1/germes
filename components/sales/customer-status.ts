import type { Dictionary } from "@/lib/i18n/get-dictionary";

/**
 * Colors are locale-independent — kept as a static map exactly as before.
 * Every key is an exact CustomerStatus enum value — no invented labels.
 */
export const CUSTOMER_STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-600",
  POTENTIAL: "bg-blue-50 text-blue-600",
  INACTIVE: "bg-slate-100 text-slate-600",
  BLOCKED: "bg-rose-50 text-rose-600",
};

/**
 * Presentation-only label lookup, driven by the resolved dictionary's
 * status.customer map. Takes just that narrow sub-map — not the whole
 * Dictionary. The underlying CustomerStatus enum value is never changed;
 * only its displayed label varies by locale. Falls back to the raw status
 * string for any value the dictionary doesn't recognize (never throws).
 */
export function getCustomerStatusLabel(labels: Dictionary["status"]["customer"], status: string): string {
  return (labels as Record<string, string>)[status] ?? status;
}
