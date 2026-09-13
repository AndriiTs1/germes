import { getCurrentUser } from "@/lib/auth/get-current-user";

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user || !user.isActive) {
    throw new Error("Unauthorized");
  }

  return user;
}
