export const SUPPORTED_LOCALES = ["en", "uk", "ru"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** English is always the safe fallback — never throw on a missing/invalid locale. */
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Presentation-only mapping to a real Intl/BCP-47 tag — for
 * Intl.NumberFormat/Intl.DateTimeFormat/Intl.PluralRules grouping, decimal
 * separators, and date formatting only. Never used to select stored data,
 * never alters a stored value: the underlying number/date is unchanged,
 * only how it's displayed.
 */
export const INTL_LOCALE_MAP: Record<Locale, string> = {
  en: "en-US",
  uk: "uk-UA",
  ru: "ru-RU",
};
