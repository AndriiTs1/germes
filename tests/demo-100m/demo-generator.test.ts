import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { CliError, parseArgs, runDryRun } from "../../scripts/demo-seed";
import { DEMO_MARKER } from "../../scripts/demo-100m/config";
import { generateDataset } from "../../scripts/demo-100m/generate";
import { DEMO_NAMESPACE, uuidV5, UUID_PATTERN } from "../../scripts/demo-100m/lib";
import { CUSTOMERS, PRODUCTS, SUPPLIERS, WAREHOUSE_CODES } from "../../scripts/demo-100m/master-data";
import { computeMetrics } from "../../scripts/demo-100m/metrics";
import { pickShowcases } from "../../scripts/demo-100m/report";
import type { DemoDataset } from "../../scripts/demo-100m/types";
import { datasetChecksum, validateDataset, type ValidationResult } from "../../scripts/demo-100m/validate";

const AS_OF = new Date("2026-09-28T12:00:00+03:00");
const SEED = "DEMO-100M-v1";
const ROOT = path.resolve(import.meta.dirname, "../..");

let ds: DemoDataset;
let result: ValidationResult;
beforeAll(() => {
  ds = generateDataset({ asOf: AS_OF, seed: SEED });
  result = validateDataset(ds, () => generateDataset({ asOf: AS_OF, seed: SEED }));
});
const metrics = () => result.metrics;
const passed = (name: RegExp) => result.checks.filter((c) => name.test(c.name)).every((c) => c.pass);

describe("determinism & isolation", () => {
  it("A. same seed + asOf → identical dataset and checksum", () => {
    const again = generateDataset({ asOf: AS_OF, seed: SEED });
    expect(datasetChecksum(again)).toBe(datasetChecksum(ds));
    expect(JSON.stringify(again)).toBe(JSON.stringify(ds));
  });

  it("B. a different seed changes the checksum", () => {
    expect(datasetChecksum(generateDataset({ asOf: AS_OF, seed: "DEMO-100M-other" }))).not.toBe(datasetChecksum(ds));
  });

  it("C. the CLI rejects --apply and --cleanup (Phase 1 is dry-run only)", () => {
    for (const argv of [
      ["--apply", "--as-of", "2026-09-28T12:00:00+03:00", "--seed", SEED],
      ["--cleanup"],
      ["--dry-run", "--apply", "--as-of", "2026-09-28T12:00:00+03:00", "--seed", SEED],
      ["--as-of", "2026-09-28T12:00:00+03:00", "--seed", SEED],
    ]) {
      expect(() => parseArgs(argv)).toThrow(CliError);
      expect(() => parseArgs(argv)).toThrow("Phase 1 supports --dry-run only");
    }
    expect(() => parseArgs(["--dry-run", "--seed", SEED])).toThrow("--as-of");
    expect(parseArgs(["--dry-run", "--as-of", "2026-09-28T12:00:00+03:00", "--seed", SEED])).toEqual({ asOf: AS_OF, seed: SEED });
  });

  it("D. needs no DATABASE_URL, and no generator file imports Prisma or reads DB env", () => {
    const saved = { DATABASE_URL: process.env.DATABASE_URL, DIRECT_URL: process.env.DIRECT_URL };
    delete process.env.DATABASE_URL;
    delete process.env.DIRECT_URL;
    try {
      expect(datasetChecksum(generateDataset({ asOf: AS_OF, seed: SEED }))).toBe(datasetChecksum(ds));
    } finally {
      if (saved.DATABASE_URL !== undefined) process.env.DATABASE_URL = saved.DATABASE_URL;
      if (saved.DIRECT_URL !== undefined) process.env.DIRECT_URL = saved.DIRECT_URL;
    }
    const files = [
      path.join(ROOT, "scripts/demo-seed.ts"),
      ...readdirSync(path.join(ROOT, "scripts/demo-100m")).map((f) => path.join(ROOT, "scripts/demo-100m", f)),
    ];
    for (const file of files) {
      const code = readFileSync(file, "utf8");
      expect(code, file).not.toMatch(/from\s+["'][^"']*(prisma|generated\/prisma|@prisma|lib\/db|\bpg["'])/);
      expect(code, file).not.toMatch(/process\.env\.(DATABASE_URL|DIRECT_URL)/);
      expect(code, file).not.toMatch(/dotenv/);
    }
  });
});

describe("sales volumes", () => {
  it("E. status counts are exact", () => {
    expect(metrics().statusCounts).toEqual({ SHIPPED: 1092, DRAFT: 20, CONFIRMED: 20, PROCESSING: 12, READY: 12, CANCELLED: 28 });
    expect(ds.salesOrders).toHaveLength(1184);
    expect(metrics().shippedUah).toBe(1080);
    expect(metrics().shippedEur).toBe(12);
  });

  it("F. monthly shipped UAH order counts are exact (Kyiv months)", () => {
    expect(metrics().months.map((m) => [m.key, m.orders])).toEqual([
      ["2025-10", 104], ["2025-11", 100], ["2025-12", 106], ["2026-01", 71], ["2026-02", 74], ["2026-03", 85],
      ["2026-04", 93], ["2026-05", 90], ["2026-06", 86], ["2026-07", 84], ["2026-08", 91], ["2026-09", 96],
    ]);
  });

  it("G. annual UAH revenue ≈ 100.1M (preferred 99.9–100.3M) and Sep/Aug trend +5…+8%", () => {
    expect(metrics().uahRevenue).toBeGreaterThanOrEqual(99_900_000_00);
    expect(metrics().uahRevenue).toBeLessThanOrEqual(100_300_000_00);
    expect(metrics().trendPct).toBeGreaterThanOrEqual(5);
    expect(metrics().trendPct).toBeLessThanOrEqual(8);
  });

  it("H. EUR revenue 135–145k, two customers, never in August/September 2026", () => {
    expect(metrics().eurRevenue).toBeGreaterThanOrEqual(135_000_00);
    expect(metrics().eurRevenue).toBeLessThanOrEqual(145_000_00);
    const eur = ds.salesOrders.filter((o) => o.currency === "EUR");
    expect(new Set(eur.map((o) => o.customerCode)).size).toBe(2);
    expect(metrics().eurShippedMonthKeys.some((k) => k === "2026-08" || k === "2026-09")).toBe(false);
    expect(eur.every((o) => o.status === "SHIPPED")).toBe(true);
  });

  it("I. AR / AP targets", () => {
    const m = metrics();
    expect(m.openArUah).toBeGreaterThanOrEqual(11_500_000_00);
    expect(m.openArUah).toBeLessThanOrEqual(12_500_000_00);
    expect(m.overdueArUah).toBeGreaterThanOrEqual(2_400_000_00);
    expect(m.overdueArUah).toBeLessThanOrEqual(2_800_000_00);
    expect(m.overdueDocsUah).toBeGreaterThanOrEqual(25);
    expect(m.overdueDocsUah).toBeLessThanOrEqual(35);
    expect(m.openArEur).toBeGreaterThanOrEqual(17_000_00);
    expect(m.openArEur).toBeLessThanOrEqual(19_000_00);
    expect(m.openApUah).toBeGreaterThanOrEqual(7_000_000_00);
    expect(m.openApUah).toBeLessThanOrEqual(8_000_000_00);
    expect(m.openApEur).toBeGreaterThanOrEqual(42_000_00);
    expect(m.openApEur).toBeLessThanOrEqual(48_000_00);
    expect(ds.receivables.some((r) => r.status === "OVERDUE" || r.status === "CANCELLED")).toBe(false);
  });
});

describe("inventory", () => {
  it("J. stock is never negative, checked chronologically per batch/warehouse", () => {
    expect(passed(/never negative chronologically/)).toBe(true);
    const running = new Map<string, number>();
    for (const mv of [...ds.movements].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || (a.type === "RECEIPT" ? -1 : 1))) {
      const key = `${mv.batchId}|${mv.type === "RECEIPT" ? mv.toWarehouseCode : mv.fromWarehouseCode}`;
      const next = (running.get(key) ?? 0) + (mv.type === "RECEIPT" ? mv.quantityKg : -mv.quantityKg);
      expect(next).toBeGreaterThanOrEqual(0);
      running.set(key, next);
    }
  });

  it("K. ACTIVE reservations never exceed current stock; physical 92–98 t, reserved 32–36 t", () => {
    expect(passed(/ACTIVE reservations <= current stock/)).toBe(true);
    expect(metrics().physicalKg).toBeGreaterThanOrEqual(92_000);
    expect(metrics().physicalKg).toBeLessThanOrEqual(98_000);
    expect(metrics().reservedKg).toBeGreaterThanOrEqual(32_000);
    expect(metrics().reservedKg).toBeLessThanOrEqual(36_000);
    expect(metrics().availableKg).toBe(metrics().physicalKg - metrics().reservedKg);
  });

  it("L. CONFIRMED reservation mix is 10 full / 5 partial / 5 none, all expiring after asOf", () => {
    const check = result.checks.find((c) => c.name.startsWith("CONFIRMED coverage"))!;
    expect(check.pass).toBe(true);
    expect(check.detail).toBe("10/5/5");
    expect(passed(/CONFIRMED ACTIVE reservations expire after asOf/)).toBe(true);
  });

  it("M. PROCESSING / READY are fully reserved, even where expiresAt has passed", () => {
    expect(passed(/PROCESSING coverage/)).toBe(true);
    expect(passed(/READY coverage/)).toBe(true);
    const asOfMs = AS_OF.getTime();
    const processingIds = new Set(ds.salesOrders.filter((o) => o.status === "PROCESSING").map((o) => o.id));
    expect(ds.reservations.some((r) => processingIds.has(r.salesOrderId) && r.status === "ACTIVE" && new Date(r.expiresAt).getTime() < asOfMs)).toBe(true);
  });

  it("N. no forbidden statuses or movement types", () => {
    expect(passed(/no prohibited statuses/)).toBe(true);
    expect(ds.salesOrders.some((o) => o.status === "COMPLETED")).toBe(false);
    expect(ds.purchaseOrders.some((p) => p.status === "CLOSED")).toBe(false);
    expect(ds.batches.every((b) => b.status === "AVAILABLE")).toBe(true);
    expect(ds.movements.every((m) => m.type === "RECEIPT" || m.type === "SHIPMENT")).toBe(true);
    expect(ds.batches.filter((b) => ["PORK-013", "PORK-023", "PORK-016"].includes(b.productSku)).every((b) => b.unitCost === null)).toBe(true);
  });
});

describe("identity & markers", () => {
  it("O. UUIDv5 helper matches the RFC test vector; all ids valid and unique", () => {
    expect(uuidV5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
    expect(DEMO_NAMESPACE).toMatch(UUID_PATTERN);
    expect(passed(/UUIDs valid and unique/)).toBe(true);
    expect(passed(/order numbers unique/)).toBe(true);
  });

  it("P. every demo entity carries the marker", () => {
    expect(passed(/carries the marker/)).toBe(true);
    expect(ds.salesOrders[0].notes).toContain(DEMO_MARKER);
    expect(ds.auditLogs[0].metadata).toMatchObject({ demo: "DEMO-100M", demoVersion: "v1" });
    expect(ds.payables.every((p) => p.reference.startsWith("DEMO100M/RCV-"))).toBe(true);
  });
});

describe("operations", () => {
  it("Q. each SALES manager holds 25–40% of UAH revenue; order responsible = customer responsible", () => {
    const shares = Object.values(metrics().managerShares);
    expect(shares).toHaveLength(3);
    for (const s of shares) {
      expect(s).toBeGreaterThanOrEqual(0.25);
      expect(s).toBeLessThanOrEqual(0.4);
    }
    const responsible = new Map(CUSTOMERS.map((c) => [c.code, c.responsible]));
    expect(ds.salesOrders.every((o) => o.responsible === responsible.get(o.customerCode))).toBe(true);
  });

  it("R. exactly 13 unique customers need attention; lastPurchaseAt = their real last shipment", () => {
    expect(metrics().attentionCustomers).toBe(13);
    const last = new Map<string, string>();
    for (const o of ds.salesOrders) if (o.shippedAt && (last.get(o.customerCode) ?? "") < o.shippedAt) last.set(o.customerCode, o.shippedAt);
    expect(ds.customerUpdates.every((c) => c.lastPurchaseAt === (last.get(c.customerCode) ?? null))).toBe(true);
    expect(ds.customerUpdates.map((c) => c.paymentTermDays).sort((a, b) => a - b).join(",")).toBe(
      [0, 0, 0, 0, ...Array(8).fill(7), ...Array(12).fill(14), ...Array(8).fill(21), ...Array(5).fill(30), 45, 45, 60, 60].join(","),
    );
    expect(ds.customerUpdates.filter((c) => c.creditLimit !== null)).toHaveLength(30);
  });

  it("S. the dry run passes every check and prints the report without entity dumps or emails", () => {
    const { report, pass, checksum } = runDryRun({ asOf: AS_OF, seed: SEED });
    expect(pass).toBe(true);
    expect(checksum).toBe(datasetChecksum(ds));
    expect(result.checks.length).toBeGreaterThanOrEqual(51);
    expect(result.failed).toEqual([]);
    expect(report).toContain("DEMO 100M DRY RUN: PASS");
    expect(report).toContain(`${result.checks.length}/${result.checks.length} PASS`);
    expect(report).toContain("DEFERRED TO STAGING APPLY PHASE");
    expect(report).not.toMatch(/@/);
    expect(report.split("\n").length).toBeLessThan(120);
  });
});

describe("master data is referenced, never invented", () => {
  it("the copied catalogue matches prisma/seed.ts exactly (41 / 44 / 42 / 2, responsibles 14 / 14 / 13)", () => {
    const seed = readFileSync(path.join(ROOT, "prisma/seed.ts"), "utf8");
    const unescape = (s: string) => JSON.parse(`"${s}"`) as string;
    const managers: Record<string, string> = { salesManager: "sales", salesManager2: "sales2", salesManager3: "sales3" };
    const customers = [...seed.matchAll(/\{ code: "(CUST-\d+)", name: "((?:[^"\\]|\\.)*)", responsibleId: (salesManager\d?)\.id \}/g)].map((m) => ({
      code: m[1],
      name: unescape(m[2]),
      responsible: managers[m[3]],
    }));
    const suppliers = [...seed.matchAll(/\{ code: "(SUP-\d+)", name: "((?:[^"\\]|\\.)*)"(?:, country: "([^"]*)")? \}/g)].map((m) => ({
      code: m[1],
      name: unescape(m[2]),
      country: m[3] ?? null,
    }));
    const products = [...seed.matchAll(/\{ sku: "([A-Z]+-\d+)", name: "((?:[^"\\]|\\.)*)", category: "([^"]*)" \}/g)].map((m) => ({
      sku: m[1],
      name: unescape(m[2]),
      category: m[3],
    }));
    expect(CUSTOMERS).toEqual(customers);
    expect(SUPPLIERS).toEqual(suppliers);
    expect(PRODUCTS).toEqual(products);
    expect([...WAREHOUSE_CODES]).toEqual([...new Set([...seed.matchAll(/code: "(WH-[A-Z]+)"/g)].map((m) => m[1]))]);
    expect([CUSTOMERS.length, SUPPLIERS.length, PRODUCTS.length, WAREHOUSE_CODES.length]).toEqual([41, 44, 42, 2]);
    const perManager = CUSTOMERS.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.responsible]: (acc[c.responsible] ?? 0) + 1 }), {});
    expect(perManager).toEqual({ sales: 14, sales2: 14, sales3: 13 });
  });

  it("the dataset only references known customer / supplier / product / warehouse codes", () => {
    const customers = new Set(CUSTOMERS.map((c) => c.code));
    const suppliers = new Set(SUPPLIERS.map((s) => s.code));
    const skus = new Set(PRODUCTS.map((p) => p.sku));
    const warehouses = new Set<string>(WAREHOUSE_CODES);
    expect(ds.salesOrders.every((o) => customers.has(o.customerCode) && o.items.every((i) => skus.has(i.productSku)))).toBe(true);
    expect(ds.batches.every((b) => suppliers.has(b.supplierCode) && skus.has(b.productSku) && warehouses.has(b.warehouseCode))).toBe(true);
    expect(ds.purchaseOrders.every((p) => suppliers.has(p.supplierCode))).toBe(true);
    expect(ds.payables.every((p) => suppliers.has(p.supplierCode))).toBe(true);
    expect(computeMetrics(ds).months).toHaveLength(12);
  });
});

describe("final calibration", () => {
  it("items per order 2.4–2.6, 1–5 lines, ≈2 850–3 080 items", () => {
    expect(metrics().itemsPerOrder).toBeGreaterThanOrEqual(2.4);
    expect(metrics().itemsPerOrder).toBeLessThanOrEqual(2.6);
    expect(metrics().itemCount).toBeGreaterThanOrEqual(2_840);
    expect(metrics().itemCount).toBeLessThanOrEqual(3_080);
    expect(ds.salesOrders.every((o) => o.items.length >= 1 && o.items.length <= 5)).toBe(true);
    const lengths = new Set(ds.salesOrders.map((o) => o.items.length));
    expect([...lengths].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("receivables exactly 960 PAID / 88 OPEN / 44 PARTIALLY_PAID, amounts still on target", () => {
    expect(metrics().receivableStatusCounts).toEqual({ PAID: 960, OPEN: 88, PARTIALLY_PAID: 44 });
    expect(metrics().openArUah).toBeGreaterThanOrEqual(11_500_000_00);
    expect(metrics().openArUah).toBeLessThanOrEqual(12_500_000_00);
  });

  it("payables exactly 130: UAH 92 / 9 / 17, EUR 8 / 1 / 3; open UAH spread over ordinary-sized documents", () => {
    expect(ds.payables).toHaveLength(130);
    expect(metrics().payableStatusCounts).toEqual({ UAH: { PAID: 92, PARTIALLY_PAID: 9, OPEN: 17 }, EUR: { PAID: 8, PARTIALLY_PAID: 1, OPEN: 3 } });
    const openUah = ds.payables.filter((p) => p.currency === "UAH" && p.status !== "PAID").map((p) => p.amount - p.paidAmount);
    expect(openUah).toHaveLength(26);
    expect(Math.max(...openUah)).toBeLessThan(900_000_00); // no single giant document
    expect(openUah.filter((v) => v < 500_000_00).length).toBeGreaterThanOrEqual(13);
  });

  it("payment events 1 100–1 250 and AuditLog 13k–16k", () => {
    expect(ds.paymentEvents.length).toBeGreaterThanOrEqual(1_100);
    expect(ds.paymentEvents.length).toBeLessThanOrEqual(1_250);
    expect(ds.auditLogs.length).toBeGreaterThanOrEqual(13_000);
    expect(ds.auditLogs.length).toBeLessThanOrEqual(16_000);
  });

  it("line prices are realistic per category; weighted averages are sensible", () => {
    expect(passed(/category band/)).toBe(true);
    const g = metrics().avgPriceByGroup;
    expect(g.pork).toBeGreaterThan(g["offal/fat"]);
    expect(g.beef).toBeGreaterThan(g.pork);
    expect(metrics().avgPriceUah).toBeGreaterThanOrEqual(90_00);
    expect(metrics().avgPriceUah).toBeLessThanOrEqual(160_00);
  });

  it("showcase #2 is a 150–250k UAH invoice, 40–60 % paid, past its due date", () => {
    const showcase = pickShowcases(ds)[1];
    const order = ds.salesOrders.find((o) => o.orderNumber === showcase.reference)!;
    const rec = ds.receivables.find((r) => r.salesOrderId === order.id)!;
    expect(rec.status).toBe("PARTIALLY_PAID");
    expect(rec.amount).toBeGreaterThanOrEqual(150_000_00);
    expect(rec.amount).toBeLessThanOrEqual(250_000_00);
    expect(rec.paidAmount / rec.amount).toBeGreaterThanOrEqual(0.4);
    expect(rec.paidAmount / rec.amount).toBeLessThanOrEqual(0.6);
    expect(new Date(rec.dueDate).getTime()).toBeLessThan(AS_OF.getTime());
  });
});

describe("stability across seeds (same algorithm, no seed-specific branches)", () => {
  const seeds = Array.from({ length: 30 }, (_, i) => `DEMO-100M-stability-${String(i + 1).padStart(2, "0")}`);

  it.each(seeds)("%s passes every hard invariant", (seed) => {
    const generate = () => generateDataset({ asOf: AS_OF, seed });
    const outcome = validateDataset(generate(), generate);
    expect(outcome.failed.map((c) => `#${c.id} ${c.name}: ${c.detail}`)).toEqual([]);
  }, 20_000);

  it("generator source has no seed-specific branch", () => {
    for (const file of ["generate.ts", "validate.ts", "metrics.ts", "config.ts"]) {
      const code = readFileSync(path.join(ROOT, "scripts/demo-100m", file), "utf8");
      // Comparisons against the seed (the "DEMO-100M-v1" dataset-version label in config.ts is not one).
      expect(code, file).not.toMatch(/\bseed\s*[!=]==|[!=]==\s*seed\b|seed\.(startsWith|includes|endsWith)\(/);
      if (file !== "config.ts") expect(code, file).not.toContain("DEMO-100M-v1");
    }
  });
});
