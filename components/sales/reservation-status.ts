import type { Dictionary } from "@/lib/i18n/get-dictionary";

/**
 * Colors are locale-independent — kept as a static map exactly as before.
 * Every key is an exact ReservationStatus enum value — no invented labels.
 */
export const RESERVATION_STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-blue-50 text-blue-600",
  RELEASED: "bg-slate-100 text-slate-600",
  EXPIRED: "bg-rose-50 text-rose-600",
  CONSUMED: "bg-emerald-50 text-emerald-600",
};

/**
 * Presentation-only label lookup, driven by the resolved dictionary's
 * status.reservation map. Takes just that narrow sub-map — not the whole
 * Dictionary. The underlying ReservationStatus enum value is never
 * changed; only its displayed label varies by locale. Falls back to the
 * raw status string for any value the dictionary doesn't recognize
 * (never throws).
 */
export function getReservationStatusLabel(
  labels: Dictionary["status"]["reservation"],
  status: string,
): string {
  return (labels as Record<string, string>)[status] ?? status;
}
