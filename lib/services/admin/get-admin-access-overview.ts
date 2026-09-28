import { prisma } from "@/lib/db/prisma";

export type AdminAccessRole = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  userCount: number;
  permissionCount: number;
};

export type AdminAccessUser = {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  authLinked: boolean;
  roles: string[];
  createdAt: Date;
};

export type AdminAccessOverview = {
  users: AdminAccessUser[];
  roles: AdminAccessRole[];
  metrics: {
    totalUsers: number;
    activeUsers: number;
    authLinkedUsers: number;
    totalRoles: number;
    totalPermissions: number;
    privilegedUsers: number;
  };
  health: {
    inactiveUsers: number;
    authMissingUsers: number;
    usersWithoutRole: number;
    usersWithMultipleRoles: number;
    unassignedPermissions: number;
    attentionCount: number;
  };
};

export async function getAdminAccessOverview(): Promise<AdminAccessOverview> {
  const [users, roles, permissions] = await Promise.all([
    prisma.user.findMany({
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
      orderBy: [
        { name: "asc" },
        { email: "asc" },
      ],
    }),

    prisma.role.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        users: {
          select: {
            userId: true,
          },
        },
        permissions: {
          select: {
            permissionId: true,
          },
        },
      },
      orderBy: {
        code: "asc",
      },
    }),

    prisma.permission.findMany({
      select: {
        id: true,
        roles: {
          select: {
            roleId: true,
          },
        },
      },
    }),
  ]);

  const mappedUsers: AdminAccessUser[] =
    users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      authLinked: Boolean(user.authUserId),
      roles: user.roles
        .map((entry) => entry.role.code)
        .sort(),
      createdAt: user.createdAt,
    }));

  const inactiveUsers =
    mappedUsers.filter(
      (user) => !user.isActive,
    ).length;

  const authMissingUsers =
    mappedUsers.filter(
      (user) => !user.authLinked,
    ).length;

  const usersWithoutRole =
    mappedUsers.filter(
      (user) => user.roles.length === 0,
    ).length;

  const usersWithMultipleRoles =
    mappedUsers.filter(
      (user) => user.roles.length > 1,
    ).length;

  const unassignedPermissions =
    permissions.filter(
      (permission) =>
        permission.roles.length === 0,
    ).length;

  const privilegedUsers =
    mappedUsers.filter((user) =>
      user.roles.some((role) =>
        ["OWNER", "ADMIN"].includes(role),
      ),
    ).length;

  return {
    users: mappedUsers,

    roles: roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      userCount: role.users.length,
      permissionCount:
        role.permissions.length,
    })),

    metrics: {
      totalUsers: mappedUsers.length,
      activeUsers:
        mappedUsers.length -
        inactiveUsers,
      authLinkedUsers:
        mappedUsers.length -
        authMissingUsers,
      totalRoles: roles.length,
      totalPermissions:
        permissions.length,
      privilegedUsers,
    },

    health: {
      inactiveUsers,
      authMissingUsers,
      usersWithoutRole,
      usersWithMultipleRoles,
      unassignedPermissions,
      attentionCount:
        inactiveUsers +
        authMissingUsers +
        usersWithoutRole +
        unassignedPermissions,
    },
  };
}
