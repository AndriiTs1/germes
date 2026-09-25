"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

/**
 * Presentation-only: the one generic string returned to the login form is
 * localized via the same cookie-only locale resolution every other server
 * boundary uses. Nothing about the Supabase auth flow below — the schema
 * check, signInWithPassword, the active-user check, or the redirect — is
 * touched by this.
 */
export async function login(
  input: LoginInput,
): Promise<{ error: string } | void> {
  const locale = await getCurrentLocale();
  const genericError = getDictionary(locale).auth.genericError;

  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    return { error: genericError };
  }

  const { email, password } = parsed.data;

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: genericError };
  }

  const user = await getCurrentUser();

  if (!user || !user.isActive) {
    await supabase.auth.signOut();
    return { error: genericError };
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);

  if (
    permissionCodes.includes("support.workspace.access") &&
    !permissionCodes.includes("dashboard.command_center.read")
  ) {
    redirect("/support");
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
