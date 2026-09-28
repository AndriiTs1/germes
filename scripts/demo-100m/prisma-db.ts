import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../lib/generated/prisma/client";
import type { DemoDb } from "./db-types";

/**
 * Real database access for --preflight / --verify / --apply only. Imported
 * dynamically by scripts/demo-seed.ts so --dry-run never loads Prisma or
 * reads DATABASE_URL. Same client setup as lib/db/prisma.ts.
 */
export function createDemoDb(): { db: DemoDb; disconnect: () => Promise<void> } {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  return { db: prisma as unknown as DemoDb, disconnect: () => prisma.$disconnect() };
}
