import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db/prisma";

/**
 * One query: all Permission.code values granted to a user through any of
 * their roles, via RolePermission. UNION across roles, deduplicated.
 */
export async function getPermissionCodesForUser(
  userId: string,
): Promise<string[]> {
  const rolePermissions = await prisma.rolePermission.findMany({
    where: {
      role: {
        users: {
          some: { userId },
        },
      },
    },
    select: {
      permission: {
        select: { code: true },
      },
    },
  });

  const codes = new Set(rolePermissions.map((rp) => rp.permission.code));

  return Array.from(codes).sort();
}

export async function getCurrentUserPermissions(): Promise<string[]> {
  const user = await requireUser();
  return getPermissionCodesForUser(user.id);
}
