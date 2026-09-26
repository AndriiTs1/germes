import type { Dictionary } from "@/lib/i18n/get-dictionary";

/** Colors are locale-independent. Every key is an exact SupplierStatus enum value. */
export const SUPPLIER_STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-600",
  POTENTIAL: "bg-blue-50 text-blue-600",
  IN_PROGRESS: "bg-amber-50 text-amber-600",
  INACTIVE: "bg-slate-100 text-slate-600",
  BLOCKED: "bg-rose-50 text-rose-600",
};

/** Localized label from dictionary.status.supplier; falls back to the raw value, never throws. */
export function getSupplierStatusLabel(labels: Dictionary["status"]["supplier"], status: string): string {
  return (labels as Record<string, string>)[status] ?? status;
}
