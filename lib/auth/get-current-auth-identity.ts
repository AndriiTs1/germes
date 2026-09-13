import { createClient } from "@/lib/supabase/server";

export type CurrentAuthIdentity = {
  userId: string;
};

export async function getCurrentAuthIdentity(): Promise<CurrentAuthIdentity | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data) {
    return null;
  }

  const sub = data.claims.sub;

  if (typeof sub !== "string" || sub.length === 0) {
    return null;
  }

  return { userId: sub };
}
