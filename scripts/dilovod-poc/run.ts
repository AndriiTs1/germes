/**
 * Dilovod PoC A — read-only operator CLI.
 *
 * Supported commands:
 *   npx tsx --env-file=.env scripts/dilovod-poc/run.ts list-metadata
 *   npx tsx --env-file=.env scripts/dilovod-poc/run.ts get-metadata <objectName>
 *
 * Required environment variables (values are never printed):
 *   DILOVOD_API_URL
 *   DILOVOD_API_KEY
 *
 * Use ONLY a test/demo Dilovod account whose API node role is read-only.
 * Prints a concise summary to stdout; writes no files.
 */

import { DilovodPocError, getMetadata, listMetadata } from "./client";

const USAGE = "usage: run.ts list-metadata | run.ts get-metadata <objectName>";

/**
 * Bounds for the structural metadata view. Metadata definitions (field names,
 * presentations, types, table parts) are printed so the real schema can be
 * discovered; any property whose name looks like a credential is redacted.
 */
const REDACTED_PROPERTY = /key|token|password|secret|authorization/i;
const MAX_DEPTH = 10;
const MAX_ARRAY_ITEMS = 300;
const MAX_STRING_LENGTH = 160;
const MAX_LINES = 3000;

function fail(message: string): never {
  console.error(`[dilovod-poc] ABORTED: ${message}`);
  process.exit(1);
}

function requireEnv(name: string): void {
  if (!process.env[name]) {
    fail(`missing required environment variable ${name}`);
  }
}

function formatPrimitive(value: unknown): string {
  if (typeof value === "string") {
    const text = value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
    return JSON.stringify(text);
  }
  if (value === null || typeof value === "number" || typeof value === "boolean") return String(value);
  return `<${typeof value}>`;
}

/** Indented tree of keys and primitive values, bounded in depth, width and length. */
function structureLines(value: unknown): string[] {
  const lines: string[] = [];

  const walk = (node: unknown, label: string, depth: number) => {
    if (lines.length >= MAX_LINES) return;
    const indent = "  ".repeat(depth);

    if (Array.isArray(node)) {
      lines.push(`${indent}${label}: [${node.length} items]`);
      if (depth >= MAX_DEPTH) return;
      node.slice(0, MAX_ARRAY_ITEMS).forEach((item, index) => walk(item, `[${index}]`, depth + 1));
      if (node.length > MAX_ARRAY_ITEMS) lines.push(`${indent}  … ${node.length - MAX_ARRAY_ITEMS} more items`);
      return;
    }

    if (node !== null && typeof node === "object") {
      const entries = Object.entries(node as Record<string, unknown>);
      lines.push(`${indent}${label}: {${entries.length} keys}`);
      if (depth >= MAX_DEPTH) return;
      for (const [key, child] of entries) {
        if (REDACTED_PROPERTY.test(key)) {
          lines.push(`${indent}  ${key}: [redacted]`);
        } else {
          walk(child, key, depth + 1);
        }
      }
      return;
    }

    lines.push(`${indent}${label}: ${formatPrimitive(node)}`);
  };

  walk(value, "metadata", 0);
  if (lines.length >= MAX_LINES) lines.push(`… output truncated at ${MAX_LINES} lines`);
  return lines;
}

async function runListMetadata() {
  const entries = await listMetadata("uk");
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));

  console.log(`[dilovod-poc] listMetadata OK — ${sorted.length} metadata objects`);
  for (const entry of sorted) {
    console.log(`${entry.name}\t${entry.presentation ?? ""}`);
  }
}

async function runGetMetadata(objectName: string | undefined) {
  if (!objectName) {
    fail(USAGE);
  }

  const metadata = await getMetadata(objectName, "uk");

  console.log(`[dilovod-poc] getMetadata OK — ${objectName}`);
  for (const line of structureLines(metadata)) {
    console.log(line);
  }
}

async function main() {
  const [command, argument] = process.argv.slice(2);

  if (command !== "list-metadata" && command !== "get-metadata") {
    fail(USAGE);
  }

  requireEnv("DILOVOD_API_URL");
  requireEnv("DILOVOD_API_KEY");

  if (command === "list-metadata") {
    await runListMetadata();
  } else {
    await runGetMetadata(argument);
  }
}

main().catch((error: unknown) => {
  if (error instanceof DilovodPocError) {
    fail(error.message);
  }
  // Never print unknown errors verbatim: they could carry request details.
  fail(`unexpected ${error instanceof Error ? error.name : typeof error}`);
});
