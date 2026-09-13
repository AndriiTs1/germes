/**
 * One-time, operator-invoked CLI bootstrap for the first Germes OWNER.
 *
 * This is NOT a web route, Server Action, or public signup path. It links
 * exactly one explicitly selected, pre-existing Germes User to a newly
 * created Supabase Auth identity, and refuses to run again once that link
 * exists.
 *
 * Run with:
 *   npx tsx scripts/bootstrap-owner.ts
 *
 * Required environment variables (never hardcode these):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 *   GERMES_BOOTSTRAP_OWNER_ID
 *   GERMES_BOOTSTRAP_OWNER_EMAIL
 *   GERMES_BOOTSTRAP_OWNER_PASSWORD
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { createClient } from "@supabase/supabase-js";

function fail(message: string): never {
  console.error(`[bootstrap-owner] ABORTED: ${message}`);
  process.exit(1);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    fail(`missing required environment variable ${name}`);
  }
  return value;
}

async function main() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseSecretKey = requireEnv("SUPABASE_SECRET_KEY");
  const ownerId = requireEnv("GERMES_BOOTSTRAP_OWNER_ID");
  const bootstrapEmail = requireEnv("GERMES_BOOTSTRAP_OWNER_EMAIL");
  const bootstrapPassword = requireEnv("GERMES_BOOTSTRAP_OWNER_PASSWORD");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // --------------------------------------------------
    // 1. Load the explicitly selected target user (by ID only).
    // --------------------------------------------------
    const targetUser = await prisma.user.findUnique({
      where: { id: ownerId },
      include: { roles: { include: { role: true } } },
    });

    if (!targetUser) {
      fail(`no Germes User found with id ${ownerId}`);
    }

    if (!targetUser.isActive) {
      fail(`target user ${targetUser.id} is not active`);
    }

    if (targetUser.authUserId !== null) {
      fail(
        `target user ${targetUser.id} already has a linked authUserId — bootstrap already completed, refusing to overwrite`,
      );
    }

    const hasOwnerRole = targetUser.roles.some(
      (userRole) => userRole.role.code === "OWNER",
    );

    if (!hasOwnerRole) {
      fail(`target user ${targetUser.id} does not have the OWNER role`);
    }

    // Email is a sanity check on the explicitly selected user only —
    // it is never used to choose which user gets linked.
    if (
      targetUser.email.trim().toLowerCase() !==
      bootstrapEmail.trim().toLowerCase()
    ) {
      fail(
        "bootstrap email does not match the explicitly selected Germes User's email",
      );
    }

    // --------------------------------------------------
    // 2. Create the Supabase Auth identity for this bootstrap account only.
    // --------------------------------------------------
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    const { data: createdAuth, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: bootstrapEmail,
        password: bootstrapPassword,
        email_confirm: true,
      });

    if (createError || !createdAuth?.user?.id) {
      fail("Supabase Auth user creation failed");
    }

    const authUserId = createdAuth.user.id;

    // --------------------------------------------------
    // 3. Atomically guarded link — cannot overwrite a link created
    //    concurrently between the checks above and this write.
    // --------------------------------------------------
    const result = await prisma.user.updateMany({
      where: {
        id: ownerId,
        authUserId: null,
        isActive: true,
      },
      data: {
        authUserId,
      },
    });

    if (result.count !== 1) {
      // Partial failure: a Supabase identity now exists with no Germes
      // link. Compensate by deleting it rather than leaving an orphan.
      const { error: deleteError } =
        await supabaseAdmin.auth.admin.deleteUser(authUserId);

      if (deleteError) {
        console.error(
          "[bootstrap-owner] ABORTED: DB linking failed AND compensating cleanup failed. " +
            "Manual operator cleanup is required in the Supabase dashboard for orphaned auth user id:",
        );
        console.error(authUserId);
        process.exit(1);
      }

      fail(
        "DB linking failed after Supabase user creation; compensating cleanup succeeded, no changes were left behind",
      );
    }

    console.log(
      "[bootstrap-owner] Success: Germes User is now linked to a Supabase Auth identity.",
    );
    console.log(`[bootstrap-owner] Germes User id: ${ownerId}`);
    console.log(`[bootstrap-owner] Supabase Auth user id: ${authUserId}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[bootstrap-owner] ABORTED: unexpected error");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
