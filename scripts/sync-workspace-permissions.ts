/**
 * Idempotent, operator-invoked sync for two explicit allow-lists —
 * SYNCED_PERMISSIONS (RolePermission grants) and
 * DEMO_USER_ROLE_RECONCILIATION (specific demo users' UserRole sets) —
 * and nothing else. Originally scoped to just the two workspace-visibility
 * permissions (workspace.sales.access, workspace.warehouse.access); RBAC
 * Phase 1 extended it to cover three routine-operational Sales permissions
 * being revoked from OWNER (sales.orders.create, sales.reservations.create,
 * sales.reservations.release). RBAC Phase 1.1 added
 * DEMO_USER_ROLE_RECONCILIATION to make owner@germes.demo OWNER-only
 * (previously also ADMIN, which silently restored every permission Phase 1
 * removed from OWNER, via role union). RBAC Phase 2B added
 * sales.orders.update (edit/confirm/cancel a sales order), also revoked
 * from OWNER for the same routine-operational reasoning. RBAC Phase 2A
 * split inventory.shipments.process into a new read permission
 * (inventory.shipments.read — kept on OWNER) and the narrowed process
 * permission (start/mark ready/ship — revoked from OWNER), so OWNER can
 * still view Warehouse fulfillment detail without being able to execute
 * its lifecycle transitions. Adding a future permission or demo user to
 * either allow-list is the same one-line pattern: add an entry whose
 * desired state matches prisma/seed.ts exactly.
 *
 * This is NOT prisma/seed.ts and must never be confused with it: the full
 * seed truncates operational/business tables (SalesOrder, SalesOrderItem,
 * StockReservation, StockMovement, Receivable, Payable) before reseeding
 * demo data. This script touches only three tables:
 *   - permissions      (upsert exactly the rows in SYNCED_PERMISSIONS, by
 *     unique `code`)
 *   - role_permissions (insert/delete rows scoped to those permission ids
 *     only — every other permission's grants are left untouched, and no
 *     deleteMany here is ever unscoped)
 *   - user_roles       (insert/delete rows scoped to one exact, resolved
 *     User.id at a time, for exactly the emails listed in
 *     DEMO_USER_ROLE_RECONCILIATION — never a blanket "every user gets
 *     exactly one role" rule, and no other user's rows are ever read or
 *     written)
 *
 * It never writes to Role, User, or any business table, and it never
 * creates a User or a Role. It fails closed (no writes at all) if any role
 * referenced by SYNCED_PERMISSIONS or DEMO_USER_ROLE_RECONCILIATION isn't
 * already present, or if any user referenced by
 * DEMO_USER_ROLE_RECONCILIATION doesn't already exist.
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
  {
    code: "sales.orders.update",
    description: "Edit or transition a sales order's status",
    // RBAC Phase 2B: OWNER removed — edit/confirm/cancel are routine
    // sales-rep execution, not owner-level controls. Matches
    // prisma/seed.ts exactly.
    roleCodes: ["ADMIN", "SALES"],
  },
  {
    code: "inventory.shipments.read",
    description: "View a sales order's Warehouse fulfillment detail",
    roleCodes: ["OWNER", "ADMIN", "WAREHOUSE"],
  },
  {
    code: "inventory.shipments.process",
    description: "Mark a sales order as shipped (physical fulfillment)",
    // RBAC Phase 2A: OWNER removed — starting/marking ready/shipping are
    // routine warehouse-operator execution, not owner-level controls.
    // OWNER retains read access via inventory.shipments.read above.
    // Matches prisma/seed.ts exactly.
    roleCodes: ["ADMIN", "WAREHOUSE"],
  },
];

// Explicit, per-email allow-list — reconciles ONE named demo user's entire
// UserRole set to exactly `roleCodes` (adds anything missing, removes
// anything not listed). This is never "every user should have exactly one
// role": it's a targeted list of specific accounts, and every read/write
// for an entry is additionally filtered by that one resolved User.id, so
// it structurally cannot touch any user not named here. Keep in sync with
// prisma/seed.ts's userRole.createMany data for the same email.
const DEMO_USER_ROLE_RECONCILIATION: {
  email: string;
  roleCodes: string[];
}[] = [
  {
    email: "owner@germes.demo",
    // RBAC Phase 1.1: OWNER-only. Previously also ADMIN, which restored
    // every permission Phase 1 removed from OWNER (role union).
    roleCodes: ["OWNER"],
  },
];

async function main() {
  requireEnv("DATABASE_URL");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // --------------------------------------------------
    // 1. Fail closed: every role referenced by either allow-list below
    //    must already exist. No Role row is created or modified by this
    //    script.
    // --------------------------------------------------
    const requiredRoleCodes = Array.from(
      new Set([
        ...SYNCED_PERMISSIONS.flatMap((permission) => permission.roleCodes),
        ...DEMO_USER_ROLE_RECONCILIATION.flatMap((demoUser) => demoUser.roleCodes),
      ]),
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
    // 1b. Fail closed: every demo user referenced by
    //     DEMO_USER_ROLE_RECONCILIATION must already exist. No User row is
    //     created or modified by this script.
    // --------------------------------------------------
    const requiredDemoEmails = DEMO_USER_ROLE_RECONCILIATION.map((demoUser) => demoUser.email);

    const demoUserRows = await prisma.user.findMany({
      where: { email: { in: requiredDemoEmails } },
    });

    const userByEmail = Object.fromEntries(demoUserRows.map((user) => [user.email, user]));
    const missingDemoEmails = requiredDemoEmails.filter((email) => !userByEmail[email]);

    if (missingDemoEmails.length > 0) {
      fail(
        `required demo user(s) not found in database: ${missingDemoEmails.join(", ")}. ` +
          "This script never creates users — run the main seed's Demo users step first.",
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

      // --------------------------------------------------
      // 4. Reconcile UserRole rows for the explicit demo-user allow-list —
      //    scoped STRICTLY to one resolved User.id at a time. Every write
      //    below is filtered by that exact userId (removals are
      //    additionally filtered by an explicit roleId list), so no other
      //    user's UserRole rows can ever be read or touched, and this is
      //    never a blanket "collapse every user to one role" operation.
      // --------------------------------------------------
      for (const demoUser of DEMO_USER_ROLE_RECONCILIATION) {
        const user = userByEmail[demoUser.email];
        const desiredRoleIds = demoUser.roleCodes.map((code) => roleByCode[code].id);

        const existingUserRoles = await tx.userRole.findMany({
          where: { userId: user.id }, // scoped — never a bare findMany({})
          select: { roleId: true },
        });
        const existingRoleIds = existingUserRoles.map((userRole) => userRole.roleId);

        const toAdd = desiredRoleIds.filter((id) => !existingRoleIds.includes(id));
        const toRemove = existingRoleIds.filter((id) => !desiredRoleIds.includes(id));

        if (toAdd.length > 0) {
          await tx.userRole.createMany({
            data: toAdd.map((roleId) => ({ userId: user.id, roleId })),
            skipDuplicates: true,
          });
        }

        if (toRemove.length > 0) {
          await tx.userRole.deleteMany({
            where: {
              userId: user.id, // scoped — this is never a bare deleteMany({})
              roleId: { in: toRemove },
            },
          });
        }

        console.log(
          `[sync-workspace-permissions] ${demoUser.email}: +${toAdd.length} -${toRemove.length} roles ` +
            `(now assigned: ${demoUser.roleCodes.join(", ")})`,
        );
      }
    });

    console.log("[sync-workspace-permissions] Success: permissions and demo user roles synced.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[sync-workspace-permissions] ABORTED: unexpected error");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
