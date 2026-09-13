/**
 * Presentation-only mapping, separate from any business logic. Every key
 * is an exact CustomerStatus enum value — no invented labels/groupings.
 */
export const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  POTENTIAL: "Potential",
  INACTIVE: "Inactive",
  BLOCKED: "Blocked",
};

export const CUSTOMER_STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-600",
  POTENTIAL: "bg-blue-50 text-blue-600",
  INACTIVE: "bg-slate-100 text-slate-600",
  BLOCKED: "bg-rose-50 text-rose-600",
};
