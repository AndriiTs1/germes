import { prisma } from "@/lib/db/prisma";

export type AdminUserListItem = {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  authLinked: boolean;
  roles: string[];
  createdAt: Date;
};

export async function listAdminUsers(): Promise<AdminUserListItem[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      authUserId: true,
      createdAt: true,
      roles: {
        select: {
          role: {
            select: {
              code: true,
            },
          },
        },
      },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    authLinked: Boolean(user.authUserId),
    roles: user.roles.map((entry) => entry.role.code).sort(),
    createdAt: user.createdAt,
  }));
}
