/**
 * Dilovod PoC A — read-only operator CLI.
 *
 * Supported command (only one in this step):
 *   npx tsx --env-file=.env scripts/dilovod-poc/run.ts list-metadata
 *
 * Required environment variables (values are never printed):
 *   DILOVOD_API_URL
 *   DILOVOD_API_KEY
 *
 * Use ONLY a test/demo Dilovod account whose API node role is read-only.
 * Prints a concise summary to stdout; writes no files.
 */

import { DilovodPocError, listMetadata } from "./client";

function fail(message: string): never {
  console.error(`[dilovod-poc] ABORTED: ${message}`);
  process.exit(1);
}

function requireEnv(name: string): void {
  if (!process.env[name]) {
    fail(`missing required environment variable ${name}`);
  }
}

async function main() {
  const command = process.argv[2];

  if (command !== "list-metadata") {
    fail("usage: run.ts list-metadata");
  }

  requireEnv("DILOVOD_API_URL");
  requireEnv("DILOVOD_API_KEY");

  const entries = await listMetadata("uk");
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));

  console.log(`[dilovod-poc] listMetadata OK — ${sorted.length} metadata objects`);
  for (const entry of sorted) {
    console.log(`${entry.name}\t${entry.presentation ?? ""}`);
  }
}

main().catch((error: unknown) => {
  if (error instanceof DilovodPocError) {
    fail(error.message);
  }
  // Never print unknown errors verbatim: they could carry request details.
  fail(`unexpected ${error instanceof Error ? error.name : typeof error}`);
});
