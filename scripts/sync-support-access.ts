import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "../lib/generated/prisma/client";

const ROLE = {
  code: "SUPPORT",
  name: "Support",
  description: "Internal Germes customer support workspace",
};

const PERMISSION = {
  code: "support.workspace.access",
  description: "Access the internal Germes support workspace",
};

function fail(message: string): never {
  console.error(`[sync-support-access] ABORTED: ${message}`);
  process.exit(1);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    fail("missing required environment variable DATABASE_URL");
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const role = await tx.role.upsert({
        where: { code: ROLE.code },
        update: {
          name: ROLE.name,
          description: ROLE.description,
        },
        create: ROLE,
        select: { id: true, code: true },
      });

      const permission = await tx.permission.upsert({
        where: { code: PERMISSION.code },
        update: {
          description: PERMISSION.description,
        },
        create: PERMISSION,
        select: { id: true, code: true },
      });

      const existingGrants = await tx.rolePermission.findMany({
        where: {
          permissionId: permission.id,
        },
        select: {
          roleId: true,
        },
      });

      const unwantedRoleIds = existingGrants
        .map((grant) => grant.roleId)
        .filter((roleId) => roleId !== role.id);

      if (unwantedRoleIds.length > 0) {
        await tx.rolePermission.deleteMany({
          where: {
            permissionId: permission.id,
            roleId: { in: unwantedRoleIds },
          },
        });
      }

      await tx.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });

      return {
        roleCode: role.code,
        permissionCode: permission.code,
        removedUnexpectedGrants: unwantedRoleIds.length,
      };
    });

    console.log(
      `[sync-support-access] ${result.permissionCode} -> ${result.roleCode}; ` +
        `removed unexpected grants: ${result.removedUnexpectedGrants}`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[sync-support-access] FAILED");
  console.error(error);
  process.exit(1);
});
