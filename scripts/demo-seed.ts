/**
 * DEMO 100M generator — CLI.
 *
 *   --dry-run    build + validate + report in memory (no database, no Prisma)
 *   --preflight  read-only check of the target database for --apply
 *   --verify     read-only check of an applied dataset (+ the real read services)
 *   --apply      write the canonical dataset (DEMO-100M-v1 @ 2026-09-28T12:00:00+03:00) in one transaction
 *
 *   npx tsx scripts/demo-seed.ts --dry-run --as-of 2026-09-28T12:00:00+03:00 --seed DEMO-100M-v1
 *
 * --dry-run never imports Prisma, never reads DATABASE_URL and never opens a
 * connection: the database modules are loaded dynamically, only by the modes
 * that need them. There is no cleanup mode.
 */

import { CANONICAL } from "./demo-100m/config";
import { generateDataset } from "./demo-100m/generate";
import { renderReport } from "./demo-100m/report";
import { datasetChecksum, validateDataset } from "./demo-100m/validate";

export type Mode = "dry-run" | "preflight" | "verify" | "apply";
export type CliOptions = { mode: Mode; asOf: Date; seed: string };

export class CliError extends Error {}

const MODES: Record<string, Mode> = { "--dry-run": "dry-run", "--preflight": "preflight", "--verify": "verify", "--apply": "apply" };

export function parseArgs(argv: string[]): CliOptions {
  if (argv.includes("--cleanup")) throw new CliError("--cleanup is not supported");
  const modes = argv.filter((a) => a in MODES).map((a) => MODES[a]);
  if (modes.length !== 1) throw new CliError("Choose exactly one mode: --dry-run, --preflight, --verify or --apply");
  const value = (flag: string) => {
    const i = argv.indexOf(flag);
    const v = i >= 0 ? argv[i + 1] : undefined;
    if (!v || v.startsWith("--")) throw new CliError(`Missing required ${flag} <value>`);
    return v;
  };
  const asOf = new Date(value("--as-of"));
  if (Number.isNaN(asOf.getTime())) throw new CliError("--as-of must be an ISO date-time, e.g. 2026-09-28T12:00:00+03:00");
  const unknown = argv.filter((a) => a.startsWith("--") && !(a in MODES) && !["--as-of", "--seed"].includes(a));
  if (unknown.length) throw new CliError(`Unknown option(s): ${unknown.join(" ")}`);
  const seed = value("--seed");
  const mode = modes[0];
  if (mode !== "dry-run" && (seed !== CANONICAL.seed || asOf.toISOString() !== CANONICAL.asOf)) {
    throw new CliError(`--${mode} is allowed only for the canonical dataset: --seed ${CANONICAL.seed} --as-of 2026-09-28T12:00:00+03:00`);
  }
  return { mode, asOf, seed };
}

/** Runs the dry run and returns { report, pass, checksum }. Never touches a database. */
export function runDryRun(options: { asOf: Date; seed: string }) {
  const started = performance.now();
  const dataset = generateDataset(options);
  const result = validateDataset(dataset, () => generateDataset(options));
  const checksum = datasetChecksum(dataset);
  const runtimeMs = Math.round(performance.now() - started);
  return { report: renderReport(dataset, result, checksum, runtimeMs), pass: result.failed.length === 0, checksum, dataset, result };
}

/** Database modes: the canonical dataset must first pass every in-memory check. */
async function runDatabaseMode(options: CliOptions) {
  const dry = runDryRun(options);
  if (!dry.pass || dry.checksum !== CANONICAL.checksum) {
    throw new CliError(`canonical dataset failed validation or checksum (${dry.checksum}) — nothing done`);
  }
  const { createDemoDb } = await import("./demo-100m/prisma-db");
  const apply = await import("./demo-100m/apply");
  const { db, disconnect } = createDemoDb();
  try {
    if (options.mode === "preflight") {
      const result = await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        return apply.preflight(tx, dry.dataset);
      }, apply.READ_ONLY_TRANSACTION_OPTIONS);
      console.log(`PREFLIGHT: ${result.alreadyApplied ? "DEMO-100M already applied" : result.ok ? "READY" : "BLOCKED"}`);
      console.log(`counts ${JSON.stringify(result.counts)}`);
      for (const p of result.problems) console.log(`  ${p}`);
      return result.ok;
    }
    if (options.mode === "verify") {
      const result = await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        return apply.verifyDemo100mApplied(tx, dry.dataset);
      }, apply.READ_ONLY_TRANSACTION_OPTIONS);
      console.log(`VERIFY (database): ${result.ok ? "PASS" : "FAIL"}`);
      for (const p of result.problems) console.log(`  ${p}`);
      const { verifyThroughServices } = await import("./demo-100m/verify-services");
      const services = await verifyThroughServices(dry.dataset);
      console.log(`VERIFY (read services): ${services.filter((c) => c.pass).length}/${services.length} PASS`);
      for (const c of services) console.log(`  ${c.pass ? "PASS" : "FAIL"} ${c.name}${c.pass ? "" : ` — ${c.detail}`}`);
      return result.ok && services.every((c) => c.pass);
    }
    const result = await apply.applyDemo100m(db, dry.dataset, dry.checksum);
    console.log("DEMO-100M APPLIED");
    console.log(`written ${JSON.stringify(result.written)}`);
    console.log(`verification ${result.verification.ok ? "PASS" : "FAIL"} ${JSON.stringify(result.verification.summary)}`);
    console.log(`previous master values (for a future cleanup) ${JSON.stringify(result.previous)}`);
    return result.verification.ok;
  } finally {
    await disconnect();
  }
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.mode === "dry-run") {
      const { report, pass } = runDryRun(options);
      console.log(report);
      process.exit(pass ? 0 : 1);
    }
    process.exit((await runDatabaseMode(options)) ? 0 : 1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  }
}

if (process.argv[1] && /demo-seed\.ts$/.test(process.argv[1])) void main();
