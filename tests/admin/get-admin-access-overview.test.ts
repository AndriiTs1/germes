import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

type MockUser = {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  authUserId: string | null;
  createdAt: Date;
  roles: {
    role: {
      code: string;
    };
  }[];
};

type MockRole = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  users: {
    userId: string;
  }[];
  permissions: {
    permissionId: string;
  }[];
};

type MockPermission = {
  id: string;
  roles: {
    roleId: string;
  }[];
};

const db = vi.hoisted(() => ({
  users: [] as MockUser[],
  roles: [] as MockRole[],
  permissions: [] as MockPermission[],
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findMany: async () => db.users,
    },
    role: {
      findMany: async () => db.roles,
    },
    permission: {
      findMany: async () => db.permissions,
    },
  },
}));

import { getAdminAccessOverview } from "@/lib/services/admin/get-admin-access-overview";

beforeEach(() => {
  db.users = [];
  db.roles = [];
  db.permissions = [];
});

describe("getAdminAccessOverview", () => {
  it("builds RBAC metrics and access health", async () => {
    db.users = [
      {
        id: "u1",
        name: "Owner",
        email: "owner@test.local",
        isActive: true,
        authUserId: "auth-1",
        createdAt: new Date("2026-01-01"),
        roles: [
          {
            role: {
              code: "OWNER",
            },
          },
        ],
      },
      {
        id: "u2",
        name: "Sales",
        email: "sales@test.local",
        isActive: true,
        authUserId: "auth-2",
        createdAt: new Date("2026-01-02"),
        roles: [
          {
            role: {
              code: "SALES",
            },
          },
        ],
      },
      {
        id: "u3",
        name: "Problem",
        email: "problem@test.local",
        isActive: false,
        authUserId: null,
        createdAt: new Date("2026-01-03"),
        roles: [],
      },
    ];

    db.roles = [
      {
        id: "r1",
        code: "OWNER",
        name: "Owner",
        description: null,
        users: [{ userId: "u1" }],
        permissions: [
          { permissionId: "p1" },
          { permissionId: "p2" },
        ],
      },
      {
        id: "r2",
        code: "SALES",
        name: "Sales",
        description: null,
        users: [{ userId: "u2" }],
        permissions: [
          { permissionId: "p1" },
        ],
      },
    ];

    db.permissions = [
      {
        id: "p1",
        roles: [
          { roleId: "r1" },
          { roleId: "r2" },
        ],
      },
      {
        id: "p2",
        roles: [
          { roleId: "r1" },
        ],
      },
      {
        id: "p3",
        roles: [],
      },
    ];

    const overview =
      await getAdminAccessOverview();

    expect(overview.metrics).toEqual({
      totalUsers: 3,
      activeUsers: 2,
      authLinkedUsers: 2,
      totalRoles: 2,
      totalPermissions: 3,
      privilegedUsers: 1,
    });

    expect(overview.health).toEqual({
      inactiveUsers: 1,
      authMissingUsers: 1,
      usersWithoutRole: 1,
      usersWithMultipleRoles: 0,
      unassignedPermissions: 1,
      attentionCount: 4,
    });

    expect(overview.roles).toEqual([
      {
        id: "r1",
        code: "OWNER",
        name: "Owner",
        description: null,
        userCount: 1,
        permissionCount: 2,
      },
      {
        id: "r2",
        code: "SALES",
        name: "Sales",
        description: null,
        userCount: 1,
        permissionCount: 1,
      },
    ]);
  });
});
