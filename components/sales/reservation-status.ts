/**
 * Presentation-only mapping, separate from any business logic. Every key
 * is an exact ReservationStatus enum value — no invented labels.
 */
export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  RELEASED: "Released",
  EXPIRED: "Expired",
  CONSUMED: "Consumed",
};

export const RESERVATION_STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-blue-50 text-blue-600",
  RELEASED: "bg-slate-100 text-slate-600",
  EXPIRED: "bg-rose-50 text-rose-600",
  CONSUMED: "bg-emerald-50 text-emerald-600",
};
