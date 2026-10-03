/**
 * Dilovod PoC A — read-only operator CLI.
 *
 * Supported commands:
 *   npx tsx --env-file=.env scripts/dilovod-poc/run.ts list-metadata
 *   npx tsx --env-file=.env scripts/dilovod-poc/run.ts get-metadata <objectName>
 *   npx tsx --env-file=.env scripts/dilovod-poc/run.ts request <objectName>
 *       --fields <path[=alias]>[,<path[=alias]>...]
 *       [--filter <alias>:<operator>:<value>]...   (IL: values separated by "|")
 *       [--limit <1..50>] [--offset <n>]
 *
 * Required environment variables (values are never printed):
 *   DILOVOD_API_URL
 *   DILOVOD_API_KEY
 *
 * Use ONLY a test/demo Dilovod account whose API node role is read-only.
 * Prints a concise summary to stdout; writes no files.
 */

import {
  DilovodPocError,
  getMetadata,
  listMetadata,
  request,
  REQUEST_OPERATORS,
  type RequestFilter,
  type RequestOperator,
} from "./client";

const USAGE =
  "usage: run.ts list-metadata | run.ts get-metadata <objectName> | " +
  "run.ts request <objectName> --fields <path[=alias]>,... [--filter <alias>:<op>:<value>]... [--limit N] [--offset N]";

/**
 * Any property whose name looks like a credential is redacted in every view.
 */
const REDACTED_PROPERTY = /key|token|password|secret|authorization/i;

type OutputBounds = { maxDepth: number; maxArrayItems: number; maxStringLength: number; maxLines: number };

/**
 * Structural metadata view: metadata definitions (field names, presentations,
 * types, table parts) are printed so the real schema can be discovered.
 */
const METADATA_BOUNDS: OutputBounds = { maxDepth: 10, maxArrayItems: 300, maxStringLength: 160, maxLines: 3000 };

/**
 * Request rows can contain business data: only requested aliases are shown,
 * and values are kept short and shallow.
 */
const REQUEST_BOUNDS: OutputBounds = { maxDepth: 3, maxArrayItems: 20, maxStringLength: 120, maxLines: 600 };

function fail(message: string): never {
  console.error(`[dilovod-poc] ABORTED: ${message}`);
  process.exit(1);
}

function requireEnv(name: string): void {
  if (!process.env[name]) {
    fail(`missing required environment variable ${name}`);
  }
}

function formatPrimitive(value: unknown, bounds: OutputBounds): string {
  if (typeof value === "string") {
    const text = value.length > bounds.maxStringLength ? `${value.slice(0, bounds.maxStringLength)}…` : value;
    return JSON.stringify(text);
  }
  if (value === null || typeof value === "number" || typeof value === "boolean") return String(value);
  return `<${typeof value}>`;
}

/** Indented tree of keys and primitive values, bounded in depth, width and length. */
function structureLines(value: unknown, rootLabel: string, bounds: OutputBounds): string[] {
  const lines: string[] = [];

  const walk = (node: unknown, label: string, depth: number) => {
    if (lines.length >= bounds.maxLines) return;
    const indent = "  ".repeat(depth);

    if (Array.isArray(node)) {
      lines.push(`${indent}${label}: [${node.length} items]`);
      if (depth >= bounds.maxDepth) return;
      node.slice(0, bounds.maxArrayItems).forEach((item, index) => walk(item, `[${index}]`, depth + 1));
      if (node.length > bounds.maxArrayItems) lines.push(`${indent}  … ${node.length - bounds.maxArrayItems} more items`);
      return;
    }

    if (node !== null && typeof node === "object") {
      const entries = Object.entries(node as Record<string, unknown>);
      lines.push(`${indent}${label}: {${entries.length} keys}`);
      if (depth >= bounds.maxDepth) return;
      for (const [key, child] of entries) {
        if (REDACTED_PROPERTY.test(key)) {
          lines.push(`${indent}  ${key}: [redacted]`);
        } else {
          walk(child, key, depth + 1);
        }
      }
      return;
    }

    lines.push(`${indent}${label}: ${formatPrimitive(node, bounds)}`);
  };

  walk(value, rootLabel, 0);
  if (lines.length >= bounds.maxLines) lines.push(`… output truncated at ${bounds.maxLines} lines`);
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
  for (const line of structureLines(metadata, "metadata", METADATA_BOUNDS)) {
    console.log(line);
  }
}

/** "path" → alias derived from the path; "path=alias" → explicit alias. */
function parseFields(spec: string | undefined): Record<string, string> {
  if (!spec) fail("request needs --fields");
  const fields: Record<string, string> = {};
  for (const item of spec.split(",")) {
    const [path, alias] = item.split("=");
    if (!path) fail("empty field in --fields");
    fields[path] = alias ?? path.replace(/\./g, "_");
  }
  return fields;
}

/** Digits-only values become numbers (safe integers or decimals); anything else stays a string. */
function parseScalar(raw: string): string | number {
  if (/^-?\d+$/.test(raw)) {
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) ? parsed : raw;
  }
  if (/^-?\d+\.\d+$/.test(raw)) return Number(raw);
  return raw;
}

/** <alias>:<operator>:<value>; the value may itself contain ":" (e.g. dates). */
function parseFilter(spec: string): RequestFilter {
  const first = spec.indexOf(":");
  const second = first < 0 ? -1 : spec.indexOf(":", first + 1);
  if (first <= 0 || second < 0) fail("--filter must be <alias>:<operator>:<value>");
  const alias = spec.slice(0, first);
  const operator = spec.slice(first + 1, second);
  const raw = spec.slice(second + 1);
  if (!(REQUEST_OPERATORS as readonly string[]).includes(operator)) fail("unsupported --filter operator");
  const value = operator === "IL" ? raw.split("|").map(parseScalar) : parseScalar(raw);
  return { alias, operator: operator as RequestOperator, value };
}

function parseInteger(raw: string | undefined, flag: string): number {
  if (raw === undefined || !/^\d+$/.test(raw)) fail(`${flag} must be a non-negative integer`);
  return Number(raw);
}

async function runRequest(objectName: string | undefined, args: string[]) {
  if (!objectName) fail(USAGE);

  let fieldsSpec: string | undefined;
  const filters: RequestFilter[] = [];
  let limit = 10;
  let offset = 0;

  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i];
    const value = args[i + 1];
    if (flag === "--fields") fieldsSpec = value;
    else if (flag === "--filter") filters.push(parseFilter(value ?? ""));
    else if (flag === "--limit") limit = parseInteger(value, "--limit");
    else if (flag === "--offset") offset = parseInteger(value, "--offset");
    else fail(`unknown argument ${flag ?? ""}`);
    i += 1;
  }

  const fields = parseFields(fieldsSpec);
  const result = await request({ objectName, fields, filters, limit, offset });

  console.log(
    `[dilovod-poc] request OK — ${objectName} — ${result.rows.length} rows shown` +
      ` (received ${result.receivedRows}, limit ${limit}${offset ? `, offset ${offset}` : ""})` +
      (result.truncated ? " — extra rows dropped" : "") +
      (result.droppedKeys > 0 ? ` — ${result.droppedKeys} unrequested keys dropped` : ""),
  );
  result.rows.forEach((row, index) => {
    for (const line of structureLines(row, `row ${index + 1}`, REQUEST_BOUNDS)) {
      console.log(line);
    }
  });
}

async function main() {
  const [command, argument, ...rest] = process.argv.slice(2);

  if (command !== "list-metadata" && command !== "get-metadata" && command !== "request") {
    fail(USAGE);
  }

  requireEnv("DILOVOD_API_URL");
  requireEnv("DILOVOD_API_KEY");

  if (command === "list-metadata") {
    await runListMetadata();
  } else if (command === "get-metadata") {
    await runGetMetadata(argument);
  } else {
    await runRequest(argument, rest);
  }
}

main().catch((error: unknown) => {
  if (error instanceof DilovodPocError) {
    fail(error.message);
  }
  // Never print unknown errors verbatim: they could carry request details.
  fail(`unexpected ${error instanceof Error ? error.name : typeof error}`);
});
