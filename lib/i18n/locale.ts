import { cache } from "react";
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
 *
 * Wrapped in React's cache() so the many call sites across one request
 * (DashboardShell's chrome, the page's own content, a server action) share
 * one cookie read instead of re-parsing it repeatedly — request-scoped
 * memoization only, never a cross-request/global cache.
 */
export const getCurrentLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  return isLocale(value) ? value : DEFAULT_LOCALE;
});
