import { formatKg } from "@/components/sales/format";
import type { PaymentDueBasis } from "@/lib/generated/prisma/enums";
import { INTL_LOCALE_MAP, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { pluralize } from "@/lib/i18n/pluralize";

/**
 * Presentation-only formatting shared by the supplier agreements list and
 * the agreement detail page — one implementation of each rule. Inputs are
 * already-serialized service values (YYYY-MM-DD dates, decimal strings).
 */

type AgreementsDictionary = Dictionary["procurement"]["supplierDetail"]["agreements"];

export function getSupplierAgreementHref(supplierId: string, agreementId: string): string {
  return `/procurement/suppliers/${supplierId}/agreements/${agreementId}`;
}

/** "YYYY-MM-DD" → locale date (01.01.2026 in uk/ru). UTC, so the stored calendar date never shifts. */
export function formatAgreementDate(value: string, locale: Locale): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(INTL_LOCALE_MAP[locale], {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatAgreementPeriod(
  agreement: { validFrom: string; validTo: string | null },
  locale: Locale,
  t: AgreementsDictionary,
): string {
  const from = formatAgreementDate(agreement.validFrom, locale);
  return agreement.validTo === null
    ? t.periodOpenEnded.replace("{from}", from)
    : t.periodRange.replace("{from}", from).replace("{to}", formatAgreementDate(agreement.validTo, locale));
}

/**
 * The structured payment terms as short lines (prepayment, then balance);
 * [] when they aren't set. paymentTermsNote is never summarized here.
 */
export function formatPaymentTermLines(
  terms: {
    prepaymentPercent: number | null;
    balanceDueDays: number | null;
    balanceDueBasis: PaymentDueBasis | null;
  },
  locale: Locale,
  t: AgreementsDictionary,
): string[] {
  const { prepaymentPercent, balanceDueDays, balanceDueBasis } = terms;
  if (prepaymentPercent === null) return [];

  const lines: string[] = [];
  if (prepaymentPercent > 0) {
    lines.push(t.payment.prepayment.replace("{percent}", String(prepaymentPercent)));
  }
  if (prepaymentPercent < 100 && balanceDueDays !== null && balanceDueBasis !== null) {
    const balancePercent = String(100 - prepaymentPercent);
    lines.push(
      balanceDueDays === 0
        ? t.payment.balanceSameDay
            .replace("{percent}", balancePercent)
            .replace("{basis}", t.payment.basisOn[balanceDueBasis])
        : t.payment.balance
            .replace("{percent}", balancePercent)
            .replace("{days}", pluralize(locale, balanceDueDays, t.payment.days))
            .replace("{basis}", t.payment.basisAfter[balanceDueBasis]),
    );
  }
  return lines;
}

/** "DAP · Kyiv, Ukraine", or just the code; null when no Incoterm is set. */
export function formatIncoterm(terms: { incoterm: string | null; incotermPlace: string | null }): string | null {
  if (terms.incoterm === null) return null;
  return terms.incotermPlace ? `${terms.incoterm} · ${terms.incotermPlace}` : terms.incoterm;
}

/**
 * Lead time shown for one agreement item: its own value wins; otherwise
 * the agreement default (marked as such); null when neither is set. 0 is a
 * real value (same-day), never treated as missing.
 */
export function resolveItemLeadTime(
  itemLeadTimeDays: number | null,
  defaultLeadTimeDays: number | null,
): { days: number; source: "item" | "agreement" } | null {
  if (itemLeadTimeDays !== null) return { days: itemLeadTimeDays, source: "item" };
  if (defaultLeadTimeDays !== null) return { days: defaultLeadTimeDays, source: "agreement" };
  return null;
}

/** Price per kg with 2–4 decimals — Decimal(14,4) prices are shown exactly, never rounded to cents. */
export function formatPricePerKg(value: string, currency: string, kgUnit: string, locale: Locale): string {
  const num = Number(value);
  const formatted = Number.isFinite(num)
    ? new Intl.NumberFormat(INTL_LOCALE_MAP[locale], { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(num)
    : value;
  return `${formatted} ${currency}/${kgUnit}`;
}

/** Tier threshold with its unit; "0" stays "0 кг" (the base tier), never an empty value. */
export function formatTierQuantity(value: string, kgUnit: string, locale: Locale): string {
  return `${formatKg(value, locale)} ${kgUnit}`;
}
