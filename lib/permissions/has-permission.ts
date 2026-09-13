import { getCurrentUserPermissions } from "@/lib/permissions/get-current-user-permissions";

/**
 * Does not catch errors: an unauthenticated/inactive user causes
 * requireUser() (inside getCurrentUserPermissions()) to throw, and that
 * propagates to the caller, as does any database/infrastructure failure.
 * Only an authenticated, active user who simply lacks the permission
 * resolves to false.
 */
export async function hasPermission(code: string): Promise<boolean> {
  const permissions = await getCurrentUserPermissions();
  return permissions.includes(code);
}
