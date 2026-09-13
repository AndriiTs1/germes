import { requireUser } from "@/lib/auth/require-user";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";

export async function requirePermission(code: string) {
  const user = await requireUser();
  const permissions = await getPermissionCodesForUser(user.id);

  if (!permissions.includes(code)) {
    throw new Error("Forbidden");
  }

  return user;
}
