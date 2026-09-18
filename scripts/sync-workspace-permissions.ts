/**
 * Idempotent, operator-invoked sync for an explicit allow-list of
 * Permission.code rows and their RolePermission grants — nothing else.
 * Originally scoped to just the two workspace-visibility permissions
 * (workspace.sales.access, workspace.warehouse.access); RBAC Phase 1
 * extended the same allow-list/reconciliation shape to cover three
 * routine-operational Sales permissions being revoked from OWNER
 * (sales.orders.create, sales.reservations.create,
 * sales.reservations.release) — see SYNCED_PERMISSIONS below. Adding a
 * future permission to this sync is the same one-line pattern: add an
 * entry here whose `roleCodes` matches prisma/seed.ts's permissionCatalog
 * entry for that code exactly.
 *
 * This is NOT prisma/seed.ts and must never be confused with it: the full
 * seed truncates operational/business tables (SalesOrder, SalesOrderItem,
 * StockReservation, StockMovement, Receivable, Payable) before reseeding
 * demo data. This script touches only two tables:
 *   - permissions      (upsert exactly the rows in SYNCED_PERMISSIONS, by
 *     unique `code`)
 *   - role_permissions (insert/delete rows scoped to those permission ids
 *     only — every other permission's grants are left untouched, and no
 *     deleteMany here is ever unscoped)
 *
 * It never writes to Role, User, UserRole, or any business table, and it
 * fails closed (no writes at all) if any role referenced by
 * SYNCED_PERMISSIONS isn't already present — it never creates roles.
 *
 * Run with:
 *   npx tsx scripts/sync-workspace-permissions.ts
 *
 * Required environment variables (never hardcode these):
 *   DATABASE_URL
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

function fail(message: string): never {
  console.error(`[sync-workspace-permissions] ABORTED: ${message}`);
  process.exit(1);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    fail(`missing required environment variable ${name}`);
  }
  return value;
}

// Single source of truth for this script's scope. Keep every entry in
// sync with the matching entry in prisma/seed.ts's permissionCatalog —
// same code, same roleCodes.
const SYNCED_PERMISSIONS: {
  code: string;
  description: string;
  roleCodes: string[];
}[] = [
  {
    code: "workspace.sales.access",
    description: "See the Sales workspace and its navigation in the sidebar",
    roleCodes: ["OWNER", "ADMIN", "SALES"],
  },
  {
    code: "workspace.warehouse.access",
    description: "See the Warehouse workspace and its navigation in the sidebar",
    roleCodes: ["OWNER", "ADMIN", "WAREHOUSE"],
  },
  {
    code: "sales.orders.create",
    description: "Create a sales order",
    // RBAC Phase 1: OWNER removed — routine sales-rep execution, not an
    // owner-level control. Matches prisma/seed.ts exactly.
    roleCodes: ["ADMIN", "SALES"],
  },
  {
    code: "sales.reservations.create",
    description: "Reserve stock for a sales order",
    roleCodes: ["ADMIN", "SALES"],
  },
  {
    code: "sales.reservations.release",
    description: "Manually release or cancel a stock reservation",
    roleCodes: ["ADMIN", "SALES"],
  },
];

async function main() {
  requireEnv("DATABASE_URL");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // --------------------------------------------------
    // 1. Fail closed: every role referenced above must already exist.
    //    No Role row is created or modified by this script.
    // --------------------------------------------------
    const requiredRoleCodes = Array.from(
      new Set(SYNCED_PERMISSIONS.flatMap((permission) => permission.roleCodes)),
    );

    const roleRows = await prisma.role.findMany({
      where: { code: { in: requiredRoleCodes } },
    });

    const roleByCode = Object.fromEntries(roleRows.map((role) => [role.code, role]));
    const missingRoleCodes = requiredRoleCodes.filter((code) => !roleByCode[code]);

    if (missingRoleCodes.length > 0) {
      fail(
        `required role(s) not found in database: ${missingRoleCodes.join(", ")}. ` +
          "This script never creates roles — run the main seed's Role step first.",
      );
    }

    // --------------------------------------------------
    // 2. Upsert exactly the Permission rows listed in SYNCED_PERMISSIONS.
    //    Never touches any other Permission row.
    // --------------------------------------------------
    const permissionByCode: Record<string, { id: string }> = {};

    for (const permission of SYNCED_PERMISSIONS) {
      const row = await prisma.permission.upsert({
        where: { code: permission.code },
        update: { description: permission.description },
        create: { code: permission.code, description: permission.description },
      });
      permissionByCode[permission.code] = row;
    }

    // --------------------------------------------------
    // 3. Reconcile RolePermission grants — scoped STRICTLY to the
    //    permissionIds resolved above, one at a time. Every write below is
    //    filtered by that exact permissionId, so no other permission's
    //    grants, and no unrelated role_permissions row, can ever be
    //    touched.
    // --------------------------------------------------
    await prisma.$transaction(async (tx) => {
      for (const permission of SYNCED_PERMISSIONS) {
        const permissionId = permissionByCode[permission.code].id;
        const desiredRoleIds = permission.roleCodes.map((code) => roleByCode[code].id);

        const existingGrants = await tx.rolePermission.findMany({
          where: { permissionId },
          select: { roleId: true },
        });
        const existingRoleIds = existingGrants.map((grant) => grant.roleId);

        const toAdd = desiredRoleIds.filter((id) => !existingRoleIds.includes(id));
        const toRemove = existingRoleIds.filter((id) => !desiredRoleIds.includes(id));

        if (toAdd.length > 0) {
          await tx.rolePermission.createMany({
            data: toAdd.map((roleId) => ({ roleId, permissionId })),
            skipDuplicates: true,
          });
        }

        if (toRemove.length > 0) {
          await tx.rolePermission.deleteMany({
            where: {
              permissionId, // scoped — this is never a bare deleteMany({})
              roleId: { in: toRemove },
            },
          });
        }

        console.log(
          `[sync-workspace-permissions] ${permission.code}: +${toAdd.length} -${toRemove.length} ` +
            `(now granted to: ${permission.roleCodes.join(", ")})`,
        );
      }
    });

    console.log("[sync-workspace-permissions] Success: permissions synced.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[sync-workspace-permissions] ABORTED: unexpected error");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
