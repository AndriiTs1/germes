import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { SupplierAgreementDisplayStatus } from "@/lib/services/procurement/supplier-agreement-display-status";
import { cn } from "@/lib/utils";

/** Colors are locale-independent; keys are the derived display statuses. */
const DISPLAY_STATUS_STYLES: Record<SupplierAgreementDisplayStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  UPCOMING: "bg-blue-50 text-blue-600",
  ACTIVE: "bg-emerald-50 text-emerald-600",
  EXPIRED: "bg-amber-50 text-amber-600",
  CLOSED: "bg-slate-100 text-slate-400",
};

/** Shared by the agreements list (size "sm") and the agreement detail header (size "md"). */
export function SupplierAgreementStatusBadge({
  status,
  labels,
  size = "sm",
}: {
  status: SupplierAgreementDisplayStatus;
  labels: Dictionary["status"]["supplierAgreement"];
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full font-semibold whitespace-nowrap",
        size === "md" ? "px-2.5 py-1 text-[12px]" : "px-2 py-0.5 text-[10.5px]",
        DISPLAY_STATUS_STYLES[status],
      )}
    >
      {labels[status]}
    </span>
  );
}
