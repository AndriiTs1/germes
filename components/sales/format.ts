/**
 * Presentation-only formatting for the SALES workspace. SALES services
 * already return money/kg quantities as decimal strings (never raw
 * Prisma.Decimal, never pre-converted to a JS number) — these helpers only
 * add human-readable grouping/labels for display, they never perform
 * arithmetic. Converting to Number here is safe specifically because it is
 * the last step before rendering: the value has already been fully summed
 * as a Prisma.Decimal upstream, and Intl.NumberFormat only adds thousands
 * separators, it doesn't recompute anything.
 */
function formatNumber(value: string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(num);
}

export function formatKg(value: string): string {
  return formatNumber(value);
}

export function formatMoney(value: string, currency: string): string {
  return `${formatNumber(value)} ${currency}`;
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}
