"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

const GENERIC_LOGIN_ERROR =
  "Unable to sign in. Please check your credentials and try again.";

export async function login(
  input: LoginInput,
): Promise<{ error: string } | void> {
  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  const { email, password } = parsed.data;

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  const user = await getCurrentUser();

  if (!user || !user.isActive) {
    await supabase.auth.signOut();
    return { error: GENERIC_LOGIN_ERROR };
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
