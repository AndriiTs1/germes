import type { Incoterm, PaymentDueBasis, SupplierAgreementStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToString } from "@/lib/services/sales/decimal";
import {
  getAgreementDisplayStatus,
  type SupplierAgreementDisplayStatus,
} from "@/lib/services/procurement/supplier-agreement-display-status";

export type SupplierAgreementDetailPriceTier = {
  id: string;
  /** Decimal(14,3) as a string; "0" is the base tier. */
  minQuantityKg: string;
  /** Decimal(14,4) as a string, in the agreement's currency. */
  pricePerKg: string;
};

export type SupplierAgreementDetailItem = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  leadTimeDays: number | null;
  /** Ascending by minQuantityKg. */
  priceTiers: SupplierAgreementDetailPriceTier[];
};

export type SupplierAgreementDetail = {
  id: string;
  supplierId: string;
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
  paymentTermsNote: string | null;
  incoterm: Incoterm | null;
  incotermVersion: number | null;
  incotermPlace: string | null;
  defaultLeadTimeDays: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Ordered by product name, then item id (same as purchase order items). */
  items: SupplierAgreementDetailItem[];
};

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Blank/whitespace-only text is "not set". */
function textOrNull(value: string | null): string | null {
  return value !== null && value.trim() !== "" ? value : null;
}

/**
 * Read-only detail of one agreement, or null when it doesn't exist OR
 * belongs to another supplier: id and supplierId are matched in the same
 * query, so a foreign agreement is indistinguishable from a missing one.
 * No auth/permission logic — the page decides who may call this and calls
 * notFound() on null.
 *
 * One query with nested selects (items → product + price tiers), ordered
 * by the database: items by product name then id, tiers by minQuantityKg
 * ascending. Decimals leave as strings and dates as strings, so the result
 * is plain, serializable data. `businessDate` ("YYYY-MM-DD") drives the
 * derived display status.
 */
export async function getSupplierAgreementDetail({
  supplierId,
  agreementId,
  businessDate,
}: {
  supplierId: string;
  agreementId: string;
  businessDate: string;
}): Promise<SupplierAgreementDetail | null> {
  const agreement = await prisma.supplierAgreement.findFirst({
    where: { id: agreementId, supplierId },
    select: {
      id: true,
      supplierId: true,
      agreementNumber: true,
      status: true,
      validFrom: true,
      validTo: true,
      currency: true,
      prepaymentPercent: true,
      balanceDueDays: true,
      balanceDueBasis: true,
      paymentTermsNote: true,
      incoterm: true,
      incotermVersion: true,
      incotermPlace: true,
      defaultLeadTimeDays: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      items: {
        select: {
          id: true,
          productId: true,
          leadTimeDays: true,
          product: { select: { sku: true, name: true } },
          priceTiers: {
            select: { id: true, minQuantityKg: true, pricePerKg: true },
            orderBy: { minQuantityKg: "asc" },
          },
        },
        orderBy: [{ product: { name: "asc" } }, { id: "asc" }],
      },
    },
  });

  if (!agreement) {
    return null;
  }

  const validFrom = toDateString(agreement.validFrom);
  const validTo = agreement.validTo ? toDateString(agreement.validTo) : null;

  return {
    id: agreement.id,
    supplierId: agreement.supplierId,
    agreementNumber: agreement.agreementNumber,
    status: agreement.status,
    displayStatus: getAgreementDisplayStatus({ status: agreement.status, validFrom, validTo }, businessDate),
    validFrom,
    validTo,
    currency: agreement.currency,
    prepaymentPercent: agreement.prepaymentPercent,
    balanceDueDays: agreement.balanceDueDays,
    balanceDueBasis: agreement.balanceDueBasis,
    paymentTermsNote: textOrNull(agreement.paymentTermsNote),
    incoterm: agreement.incoterm,
    incotermVersion: agreement.incotermVersion,
    incotermPlace: textOrNull(agreement.incotermPlace),
    defaultLeadTimeDays: agreement.defaultLeadTimeDays,
    notes: textOrNull(agreement.notes),
    createdAt: agreement.createdAt.toISOString(),
    updatedAt: agreement.updatedAt.toISOString(),
    items: agreement.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      sku: item.product.sku,
      leadTimeDays: item.leadTimeDays,
      priceTiers: item.priceTiers.map((tier) => ({
        id: tier.id,
        minQuantityKg: decimalToString(tier.minQuantityKg),
        pricePerKg: decimalToString(tier.pricePerKg),
      })),
    })),
  };
}
