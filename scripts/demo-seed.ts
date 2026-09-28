/**
 * DEMO 100M generator — CLI. Phase 1: pure in-memory dry run.
 *
 *   npx tsx scripts/demo-seed.ts --dry-run --as-of 2026-09-28T12:00:00+03:00 --seed DEMO-100M-v1
 *
 * This file and everything under scripts/demo-100m/ never import Prisma,
 * never read DATABASE_URL and never open a connection: the dataset is built,
 * validated and reported in memory only. There is no apply / cleanup mode.
 */

import { generateDataset } from "./demo-100m/generate";
import { renderReport } from "./demo-100m/report";
import { datasetChecksum, validateDataset } from "./demo-100m/validate";

export type CliOptions = { asOf: Date; seed: string };

export class CliError extends Error {}

export function parseArgs(argv: string[]): CliOptions {
  if (argv.includes("--apply") || argv.includes("--cleanup")) {
    throw new CliError("Phase 1 supports --dry-run only");
  }
  if (!argv.includes("--dry-run")) throw new CliError("Phase 1 supports --dry-run only");
  const value = (flag: string) => {
    const i = argv.indexOf(flag);
    const v = i >= 0 ? argv[i + 1] : undefined;
    if (!v || v.startsWith("--")) throw new CliError(`Missing required ${flag} <value>`);
    return v;
  };
  const asOf = new Date(value("--as-of"));
  if (Number.isNaN(asOf.getTime())) throw new CliError("--as-of must be an ISO date-time, e.g. 2026-09-28T12:00:00+03:00");
  const unknown = argv.filter((a) => a.startsWith("--") && !["--dry-run", "--as-of", "--seed"].includes(a));
  if (unknown.length) throw new CliError(`Unknown option(s): ${unknown.join(" ")}`);
  return { asOf, seed: value("--seed") };
}

/** Runs the dry run and returns { report, pass, checksum }. Never touches a database. */
export function runDryRun(options: CliOptions) {
  const started = performance.now();
  const dataset = generateDataset(options);
  const result = validateDataset(dataset, () => generateDataset(options));
  const checksum = datasetChecksum(dataset);
  const runtimeMs = Math.round(performance.now() - started);
  return { report: renderReport(dataset, result, checksum, runtimeMs), pass: result.failed.length === 0, checksum, dataset, result };
}

function main() {
  try {
    const { report, pass } = runDryRun(parseArgs(process.argv.slice(2)));
    console.log(report);
    process.exit(pass ? 0 : 1);
  } catch (error) {
    console.error(error instanceof CliError ? error.message : error);
    process.exit(2);
  }
}

if (process.argv[1] && /demo-seed\.ts$/.test(process.argv[1])) main();
