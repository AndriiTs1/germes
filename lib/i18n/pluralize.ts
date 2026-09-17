import { INTL_LOCALE_MAP, type Locale } from "@/lib/i18n/config";

/** One string per CLDR plural category Intl.PluralRules can select, each containing a "{count}" token. */
export type PluralForms = {
  one: string;
  few: string;
  many: string;
  other: string;
};

/**
 * Genuinely correct pluralization per locale (English's two-form "one" /
 * "other" and Ukrainian/Russian's four-form "one" / "few" / "many" /
 * "other") via the built-in Intl.PluralRules — no new dependency, no
 * hand-rolled plural rules.
 */
export function pluralize(locale: Locale, count: number, forms: PluralForms): string {
  const category = new Intl.PluralRules(INTL_LOCALE_MAP[locale]).select(count);
  // Intl.LDMLPluralRule also includes "zero"/"two" (used by some locales,
  // never en/uk/ru) — PluralForms only models the four categories this app
  // actually needs, so any other category safely falls back to "other".
  const template = (forms as Record<string, string | undefined>)[category] ?? forms.other;
  return template.replace("{count}", String(count));
}
