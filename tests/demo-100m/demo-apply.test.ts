import { beforeAll, describe, expect, it } from "vitest";

import { CliError, parseArgs, runDryRun } from "../../scripts/demo-seed";
import {
  applyDemo100m,
  DemoAlreadyAppliedError,
  DemoApplyError,
  preflight,
  verifyDemo100mApplied,
} from "../../scripts/demo-100m/apply";
import { CANONICAL, DEMO_MARKER } from "../../scripts/demo-100m/config";
import { generateDataset } from "../../scripts/demo-100m/generate";
import { minorToDecimal } from "../../scripts/demo-100m/lib";
import type { DemoDataset } from "../../scripts/demo-100m/types";
import { datasetChecksum } from "../../scripts/demo-100m/validate";
import { productionBaseline, type FakeDb } from "./fake-db";

const CANONICAL_AS_OF = "2026-09-28T12:00:00+03:00";
let ds: DemoDataset;
let checksum: string;
beforeAll(() => {
  ds = generateDataset({ asOf: new Date(CANONICAL_AS_OF), seed: CANONICAL.seed });
  checksum = datasetChecksum(ds);
});

const DEMO_TABLES = ["salesOrder", "salesOrderItem", "batch", "stockMovement", "stockReservation", "receivable", "payable"] as const;
const demoRowCount = (db: FakeDb) => DEMO_TABLES.reduce((s, t) => s + db.tables[t].length, 0);

async function appliedDb() {
  const db = productionBaseline();
  const result = await applyDemo100m(db, ds, checksum);
  return { db, result };
}

describe("CLI guards", () => {
  it("1. --apply requires the canonical seed", () => {
    expect(() => parseArgs(["--apply", "--as-of", CANONICAL_AS_OF, "--seed", "DEMO-100M-other"])).toThrow(CliError);
    expect(() => parseArgs(["--apply", "--as-of", CANONICAL_AS_OF, "--seed", "DEMO-100M-other"])).toThrow("canonical dataset");
    expect(parseArgs(["--apply", "--as-of", CANONICAL_AS_OF, "--seed", CANONICAL.seed]).mode).toBe("apply");
  });

  it("2. --apply requires an explicit (canonical) as-of", () => {
    expect(() => parseArgs(["--apply", "--seed", CANONICAL.seed])).toThrow("--as-of");
    expect(() => parseArgs(["--apply", "--as-of", "2026-09-29T12:00:00+03:00", "--seed", CANONICAL.seed])).toThrow("canonical dataset");
  });

  it("cleanup is not available; exactly one mode is required", () => {
    expect(() => parseArgs(["--cleanup", "--as-of", CANONICAL_AS_OF, "--seed", CANONICAL.seed])).toThrow("--cleanup is not supported");
    expect(() => parseArgs(["--dry-run", "--apply", "--as-of", CANONICAL_AS_OF, "--seed", CANONICAL.seed])).toThrow("exactly one mode");
    expect(() => parseArgs(["--as-of", CANONICAL_AS_OF, "--seed", CANONICAL.seed])).toThrow("exactly one mode");
  });

  it("applyDemo100m itself refuses a non-canonical dataset before touching the database", async () => {
    const db = productionBaseline();
    const other = generateDataset({ asOf: new Date(CANONICAL_AS_OF), seed: "DEMO-100M-other" });
    await expect(applyDemo100m(db, other, datasetChecksum(other))).rejects.toThrow(DemoApplyError);
    await expect(applyDemo100m(db, ds, "0".repeat(64))).rejects.toThrow("canonical");
    expect(db.writes).toBe(0);
  });
});

describe("preflight stops before the first write", () => {
  it("3. baseline mismatch (a real sales order exists) → nothing written", async () => {
    const db = productionBaseline();
    db.tables.salesOrder.push({ id: "real-order", orderNumber: "SO-2026-999", customerId: "customer-0", notes: null });
    const before = db.dump();
    await expect(applyDemo100m(db, ds, checksum)).rejects.toThrow(/preflight failed[\s\S]*salesOrder has 1 rows/);
    expect(db.writes).toBe(0);
    expect(db.dump()).toEqual(before);
  });

  it("3b. an unexpected purchase order or a changed master count also blocks", async () => {
    const po = productionBaseline();
    po.tables.purchaseOrder.push({ id: "po-new", orderNumber: "PO-2026-050", status: "DRAFT", notes: null });
    await expect(applyDemo100m(po, ds, checksum)).rejects.toThrow("unexpected purchase order PO-2026-050");
    const extra = productionBaseline();
    extra.tables.customer.push({ id: "customer-x", code: "CUST-999", responsibleId: null, paymentTermDays: 0 });
    await expect(applyDemo100m(extra, ds, checksum)).rejects.toThrow("customers = 42, expected 41");
    expect(po.writes + extra.writes).toBe(0);
  });

  it("4. a missing master reference (product) → nothing written", async () => {
    const db = productionBaseline();
    db.tables.product = db.tables.product.filter((p) => p.sku !== "PORK-013");
    db.tables.product.push({ id: "product-extra", sku: "OTHER-1", isActive: true }); // keep the count at 42
    await expect(applyDemo100m(db, ds, checksum)).rejects.toThrow("product PORK-013 missing");
    expect(db.writes).toBe(0);
  });

  it("4b. a demo account without its role, or a customer with another owner → nothing written", async () => {
    const roleless = productionBaseline();
    roleless.tables.user = roleless.tables.user.map((u) => (u.id === "user-accounting" ? { ...u, roles: [] } : u));
    await expect(applyDemo100m(roleless, ds, checksum)).rejects.toThrow('"accounting" is inactive or lacks role ACCOUNTING');
    const reassigned = productionBaseline();
    reassigned.tables.customer[0] = { ...reassigned.tables.customer[0], responsibleId: "user-sales2" === reassigned.tables.customer[0].responsibleId ? "user-sales" : "user-sales2" };
    await expect(applyDemo100m(reassigned, ds, checksum)).rejects.toThrow("responsible differs");
    expect(roleless.writes + reassigned.writes).toBe(0);
  });

  it("5. already applied → 'DEMO-100M already applied', no second insert", async () => {
    const { db } = await appliedDb();
    const writes = db.writes;
    const before = db.dump();
    await expect(applyDemo100m(db, ds, checksum)).rejects.toThrow(DemoAlreadyAppliedError);
    await expect(applyDemo100m(db, ds, checksum)).rejects.toThrow("DEMO-100M already applied");
    expect(db.writes).toBe(writes);
    expect(db.dump()).toEqual(before);
  });

  it("the read-only preflight never writes (READ ONLY transaction)", async () => {
    const db = productionBaseline();
    const result = await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      return preflight(tx, ds);
    });
    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
    expect(result.counts).toMatchObject({ customers: 41, suppliers: 44, products: 42, warehouses: 2, salesUsers: 3, salesOrder: 0, purchaseOrder: 1 });
    expect(db.writes).toBe(0);
    await expect(db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.salesOrder.createMany({ data: [] });
    })).rejects.toThrow("READ ONLY");
  });
});

describe("apply writes exactly the canonical dataset", () => {
  it("6. deterministic ids are preserved (no new ids)", async () => {
    const { db } = await appliedDb();
    expect(db.tables.salesOrder.map((o) => o.id).sort()).toEqual(ds.salesOrders.map((o) => o.id).sort());
    expect(db.tables.receivable.map((r) => r.id).sort()).toEqual(ds.receivables.map((r) => r.id).sort());
    const demoAudit = db.tables.auditLog.filter((a) => !String(a.id).startsWith("old-audit-"));
    expect(demoAudit.map((a) => a.id).sort()).toEqual(ds.auditLogs.map((a) => a.id).sort());
  });

  it("7. a failure mid-way rolls everything back (customers, suppliers and every table)", async () => {
    const db = productionBaseline();
    const before = db.dump();
    db.failOnTable = "auditLog"; // the very last insert
    await expect(applyDemo100m(db, ds, checksum)).rejects.toThrow("injected failure on auditLog");
    expect(db.dump()).toEqual(before);
    expect(demoRowCount(db)).toBe(0);
  });

  it("8 + 9. customer responsibleId, codes, names and master counts are unchanged", async () => {
    const before = productionBaseline();
    const { db } = await appliedDb();
    for (const table of ["customer", "supplier", "product", "warehouse", "user"] as const) expect(db.tables[table]).toHaveLength(before.tables[table].length);
    for (const [i, c] of db.tables.customer.entries()) {
      const was = before.tables.customer[i];
      expect([c.id, c.code, c.name, c.status, c.responsibleId]).toEqual([was.id, was.code, was.name, was.status, was.responsibleId]);
    }
    for (const [i, s] of db.tables.supplier.entries()) {
      const was = before.tables.supplier[i];
      expect([s.id, s.code, s.name, s.status]).toEqual([was.id, was.code, was.name, was.status]);
    }
    // The old cancelled purchase order and the 40 old audit rows are untouched.
    expect(db.tables.purchaseOrder.find((p) => p.orderNumber === "PO-2026-001")).toEqual(before.tables.purchaseOrder[0]);
    expect(db.tables.auditLog.filter((a) => String(a.id).startsWith("old-audit-"))).toHaveLength(40);
  });

  it("10. every generated entity count is written", async () => {
    const { db, result } = await appliedDb();
    expect(result.written).toEqual({
      customerUpdates: 41,
      supplierUpdates: ds.supplierUpdates.length,
      batches: ds.batches.length,
      salesOrders: 1184,
      salesOrderItems: ds.salesOrders.reduce((s, o) => s + o.items.length, 0),
      stockMovements: ds.movements.length,
      stockReservations: ds.reservations.length,
      receivables: 1092,
      purchaseOrders: 45,
      purchaseOrderItems: ds.purchaseOrders.reduce((s, p) => s + p.items.length, 0),
      payables: 130,
      auditLogs: ds.auditLogs.length,
    });
    expect(db.tables.purchaseOrder).toHaveLength(46); // 45 demo + the old one
    expect(result.verification.ok).toBe(true);
  });

  it("11. money and quantities are exact Decimals (no float drift)", async () => {
    const { db } = await appliedDb();
    const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
    const receivables = byId(ds.receivables);
    for (const row of db.tables.receivable) {
      const r = receivables.get(String(row.id))!;
      expect(String(row.amount)).toBe(minorToDecimal(r.amount));
      expect(String(row.paidAmount)).toBe(minorToDecimal(r.paidAmount));
    }
    const payables = byId(ds.payables);
    for (const row of db.tables.payable) {
      expect(String(row.amount)).toBe(minorToDecimal(payables.get(String(row.id))!.amount));
      expect(String(row.paidAmount)).toBe(minorToDecimal(payables.get(String(row.id))!.paidAmount));
    }
    const items = byId(ds.salesOrders.flatMap((o) => o.items));
    for (const row of db.tables.salesOrderItem) {
      const it = items.get(String(row.id))!;
      expect(String(row.quantityKg)).toBe(String(it.quantityKg));
      expect(String(row.pricePerKg)).toBe(minorToDecimal(it.pricePerKg));
    }
    const batches = byId(ds.batches);
    for (const row of db.tables.batch) {
      const b = batches.get(String(row.id))!;
      expect(row.unitCost === null ? null : String(row.unitCost)).toBe(b.unitCost === null ? null : minorToDecimal(b.unitCost));
      expect(String(row.receivedKg)).toBe(String(b.receivedKg));
    }
    // Exact totals survive the round trip.
    const total = db.tables.receivable.filter((r) => r.currency === "UAH").reduce((s, r) => s + Math.round(Number(String(r.amount)) * 100), 0);
    expect(total).toBe(ds.receivables.filter((r) => r.currency === "UAH").reduce((s, r) => s + r.amount, 0));
  });

  it("12. markers on every demo row and audit entry; audit metadata in the services' shape", async () => {
    const { db } = await appliedDb();
    for (const table of ["salesOrder", "batch", "stockMovement", "stockReservation", "receivable", "payable"] as const) {
      expect(db.tables[table].every((r) => String(r.notes).includes(DEMO_MARKER))).toBe(true);
    }
    expect(db.tables.purchaseOrder.filter((p) => p.id !== "po-old").every((p) => String(p.notes).includes(DEMO_MARKER))).toBe(true);
    const demoAudit = db.tables.auditLog.filter((a) => !String(a.id).startsWith("old-audit-"));
    expect(demoAudit.every((a) => (a.metadata as Record<string, unknown>).demo === "DEMO-100M" && (a.metadata as Record<string, unknown>).demoVersion === "v1")).toBe(true);
    const created = demoAudit.find((a) => a.entityType === "SalesOrder" && a.action === "CREATE")!.metadata as Record<string, unknown>;
    expect(created.customerId).toMatch(/^customer-/);
    expect(created).not.toHaveProperty("customerCode");
    const payment = demoAudit.find((a) => a.action === "REGISTER_PAYMENT")!.metadata as Record<string, unknown>;
    expect(typeof payment.paymentAmount).toBe("string");
    expect(demoAudit.every((a) => a.actorId === null || String(a.actorId).startsWith("user-"))).toBe(true);
  });
});

describe("verifyDemo100mApplied", () => {
  it("13. passes on the applied data and catches corruption", async () => {
    const { db } = await appliedDb();
    expect((await verifyDemo100mApplied(db, ds)).ok).toBe(true);

    const paid = db.tables.receivable.find((r) => r.status === "PAID" && r.currency === "UAH")!;
    paid.status = "OPEN";
    const corrupted = await verifyDemo100mApplied(db, ds);
    expect(corrupted.ok).toBe(false);
    expect(corrupted.problems.join("\n")).toMatch(/ar\.openUAH|receivables\.PAID/);
    paid.status = "PAID";

    db.tables.stockMovement.pop();
    const missing = await verifyDemo100mApplied(db, ds);
    expect(missing.ok).toBe(false);
    expect(missing.problems.join("\n")).toMatch(/rows\.stockMovement/);

    const empty = await verifyDemo100mApplied(productionBaseline(), ds);
    expect(empty.ok).toBe(false);
  });
});

describe("dry-run is unaffected", () => {
  it("14 + 15. --dry-run needs no database and the canonical checksum is unchanged", () => {
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      expect(parseArgs(["--dry-run", "--as-of", CANONICAL_AS_OF, "--seed", CANONICAL.seed]).mode).toBe("dry-run");
      const { pass, checksum: dryChecksum } = runDryRun({ asOf: new Date(CANONICAL_AS_OF), seed: CANONICAL.seed });
      expect(pass).toBe(true);
      expect(dryChecksum).toBe(CANONICAL.checksum);
      expect(dryChecksum).toBe("6327ab92e308817b04f5bf1a65feb0dc47e1377232c8da375fbb4a916c899395");
    } finally {
      if (saved !== undefined) process.env.DATABASE_URL = saved;
    }
  });
});
