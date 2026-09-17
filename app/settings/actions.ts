"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isLocale } from "@/lib/i18n/config";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/locale";

const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

/**
 * Sets the germes-locale cookie and returns to /settings — the only place
 * that currently offers a language switch, so a fixed redirect target is
 * both correct and avoids accepting an untrusted arbitrary return URL.
 *
 * Presentation preference only: no Prisma write, no Supabase metadata, no
 * auth/session cookie touched, no permission check (Settings is already
 * reachable by every authenticated user — see app/settings/page.tsx). An
 * invalid/missing locale value is ignored rather than thrown on; the
 * request just returns to Settings with whatever locale was already set.
 */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const requestedLocale = formData.get("locale");

  if (isLocale(requestedLocale)) {
    const cookieStore = await cookies();

    cookieStore.set(LOCALE_COOKIE_NAME, requestedLocale, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    });
  }

  revalidatePath("/settings");
  redirect("/settings");
}
