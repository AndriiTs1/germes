import type { Dictionary } from "@/lib/i18n/get-dictionary";

/** Colors are locale-independent. Every key is an exact PurchaseOrderStatus enum value. */
export const PURCHASE_ORDER_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  CONFIRMED: "bg-blue-50 text-blue-600",
  CLOSED: "bg-emerald-50 text-emerald-600",
  CANCELLED: "bg-rose-50 text-rose-600",
};

/** Localized label from dictionary.status.purchaseOrder; falls back to the raw value, never throws. */
export function getPurchaseOrderStatusLabel(
  labels: Dictionary["status"]["purchaseOrder"],
  status: string,
): string {
  return (labels as Record<string, string>)[status] ?? status;
}
