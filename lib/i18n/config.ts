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
