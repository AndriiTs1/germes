import type { Incoterm, PaymentDueBasis, SupplierAgreementStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  getAgreementDisplayStatus,
  type SupplierAgreementDisplayStatus,
} from "@/lib/services/procurement/supplier-agreement-display-status";

export type SupplierAgreementListItem = {
  id: string;
  agreementNumber: string;
  status: SupplierAgreementStatus;
  displayStatus: SupplierAgreementDisplayStatus;
  /** "YYYY-MM-DD" (stored as UTC midnight). */
  validFrom: string;
  /** "YYYY-MM-DD", or null for an open-ended agreement. */
  validTo: string | null;
  currency: string;
  prepaymentPercent: number | null;
  balanceDueDays: number | null;
  balanceDueBasis: PaymentDueBasis | null;
  incoterm: Incoterm | null;
  incotermPlace: string | null;
};

/** In-force agreements first, then upcoming, expired, drafts, closed. */
const DISPLAY_STATUS_ORDER: Record<SupplierAgreementDisplayStatus, number> = {
  ACTIVE: 0,
  UPCOMING: 1,
  EXPIRED: 2,
  DRAFT: 3,
  CLOSED: 4,
};

/** Plain code-unit order — independent of runtime locale, unlike localeCompare. */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Read-only list of one supplier's agreements for the supplier card's
 * "Agreements" tab. No auth/permission logic — the page decides who may
 * call this. `businessDate` ("YYYY-MM-DD") is passed in, so the derived
 * display status and the order are deterministic for a given date.
 *
 * Order: display-status group (see DISPLAY_STATUS_ORDER), then newest
 * validFrom first, then agreementNumber, then id — a supplier has few
 * agreements, so grouping happens here rather than in SQL.
 */
export async function listSupplierAgreements(
  supplierId: string,
  businessDate: string,
): Promise<SupplierAgreementListItem[]> {
  const rows = await prisma.supplierAgreement.findMany({
    where: { supplierId },
    select: {
      id: true,
      agreementNumber: true,
      status: true,
      validFrom: true,
      validTo: true,
      currency: true,
      prepaymentPercent: true,
      balanceDueDays: true,
      balanceDueBasis: true,
      incoterm: true,
      incotermPlace: true,
    },
  });

  const items = rows.map((row): SupplierAgreementListItem => {
    const validFrom = toDateString(row.validFrom);
    const validTo = row.validTo ? toDateString(row.validTo) : null;
    return {
      id: row.id,
      agreementNumber: row.agreementNumber,
      status: row.status,
      displayStatus: getAgreementDisplayStatus({ status: row.status, validFrom, validTo }, businessDate),
      validFrom,
      validTo,
      currency: row.currency,
      prepaymentPercent: row.prepaymentPercent,
      balanceDueDays: row.balanceDueDays,
      balanceDueBasis: row.balanceDueBasis,
      incoterm: row.incoterm,
      incotermPlace: row.incotermPlace,
    };
  });

  return items.sort(
    (a, b) =>
      DISPLAY_STATUS_ORDER[a.displayStatus] - DISPLAY_STATUS_ORDER[b.displayStatus] ||
      compareText(b.validFrom, a.validFrom) ||
      compareText(a.agreementNumber, b.agreementNumber) ||
      compareText(a.id, b.id),
  );
}
