import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";

/** Single source of truth for the cookie name — read here, written by app/settings/actions.ts. */
export const LOCALE_COOKIE_NAME = "germes-locale";

/**
 * Resolves the current UI locale from the germes-locale cookie only.
 *
 * Presentation-only: never depends on auth (requireUser/requirePermission),
 * never queries Prisma, never touches localStorage. A missing or invalid
 * cookie value falls back to DEFAULT_LOCALE — this never throws, so no
 * page can break because of a bad locale cookie.
 */
export async function getCurrentLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  return isLocale(value) ? value : DEFAULT_LOCALE;
}
