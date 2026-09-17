import { DEFAULT_LOCALE, INTL_LOCALE_MAP, type Locale } from "@/lib/i18n/config";

/**
 * Presentation-only formatting for the SALES/WAREHOUSE surfaces. Services
 * already return money/kg quantities as decimal strings (never raw
 * Prisma.Decimal, never pre-converted to a JS number) — these helpers only
 * add human-readable grouping/labels for display, they never perform
 * arithmetic. Converting to Number here is safe specifically because it is
 * the last step before rendering: the value has already been fully summed
 * as a Prisma.Decimal upstream, and Intl.NumberFormat only adds thousands
 * separators, it doesn't recompute anything.
 *
 * `locale` is optional and defaults to DEFAULT_LOCALE (English) — every
 * existing call site keeps working unchanged; callers that already have a
 * resolved UI locale pass it through for real locale-aware grouping/date
 * presentation. Never changes the underlying value, currency code, or
 * stored date — only how it's displayed.
 */
function formatNumber(value: string, locale: Locale = DEFAULT_LOCALE): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return new Intl.NumberFormat(INTL_LOCALE_MAP[locale], { maximumFractionDigits: 2 }).format(num);
}

export function formatKg(value: string, locale: Locale = DEFAULT_LOCALE): string {
  return formatNumber(value, locale);
}

export function formatMoney(value: string, currency: string, locale: Locale = DEFAULT_LOCALE): string {
  return `${formatNumber(value, locale)} ${currency}`;
}

export function formatShortDate(iso: string, locale: Locale = DEFAULT_LOCALE): string {
  return new Date(iso).toLocaleDateString(INTL_LOCALE_MAP[locale], {
    day: "numeric",
    month: "short",
  });
}

/**
 * Display-only preview number formatting (order/line totals computed live
 * in a form, never sent to the server as-is) — same grouping rules as
 * formatKg/formatMoney, but takes a plain JS number since these previews
 * are never a Prisma.Decimal-derived string.
 */
export function formatPreviewNumber(value: number, locale: Locale = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(INTL_LOCALE_MAP[locale], { maximumFractionDigits: 2 }).format(value);
}
