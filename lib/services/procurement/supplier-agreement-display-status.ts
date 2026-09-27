import type { SupplierAgreementStatus } from "@/lib/generated/prisma/enums";

/**
 * What the UI shows for an agreement. Only DRAFT/ACTIVE/CLOSED are stored;
 * UPCOMING and EXPIRED are derived from ACTIVE + the validity period and a
 * business date, never persisted — so they can't drift out of sync.
 */
export type SupplierAgreementDisplayStatus = "DRAFT" | "UPCOMING" | "ACTIVE" | "EXPIRED" | "CLOSED";

/** Germes runs on Ukrainian business days (same zone as the order history timeline). */
const BUSINESS_TIME_ZONE = "Europe/Kyiv";

/**
 * The calendar date ("YYYY-MM-DD") in Kyiv at `now`. The caller passes the
 * instant explicitly (once per request), so everything downstream is a
 * pure function of plain date strings.
 */
export function getBusinessDate(now: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Pure: every input is a "YYYY-MM-DD" string, so string order is calendar
 * order and no clock or runtime timezone is involved. Both ends of the
 * validity period are inclusive; validTo = null means open-ended.
 */
export function getAgreementDisplayStatus(
  agreement: { status: SupplierAgreementStatus; validFrom: string; validTo: string | null },
  businessDate: string,
): SupplierAgreementDisplayStatus {
  if (agreement.status !== "ACTIVE") return agreement.status;
  if (businessDate < agreement.validFrom) return "UPCOMING";
  if (agreement.validTo !== null && businessDate > agreement.validTo) return "EXPIRED";
  return "ACTIVE";
}
