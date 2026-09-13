import { getCurrentAuthIdentity } from "@/lib/auth/get-current-auth-identity";
import { prisma } from "@/lib/db/prisma";

export async function getCurrentUser() {
  const identity = await getCurrentAuthIdentity();

  if (!identity) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { authUserId: identity.userId },
  });

  return user;
}
