import type { Locale } from "@/lib/i18n/config";
import { en, type Dictionary } from "@/lib/i18n/dictionaries/en";
import { ru } from "@/lib/i18n/dictionaries/ru";
import { uk } from "@/lib/i18n/dictionaries/uk";

export type { Dictionary };

const DICTIONARIES: Record<Locale, Dictionary> = { en, uk, ru };

/** Plain synchronous lookup — no I/O, no React Context, safe to call from any Server Component. */
export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
