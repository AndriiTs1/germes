import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/lib/generated/prisma/client";

type Reservation = {
  id: string;
  productId: string;
  batchId: string;
  warehouseId: string;
  quantityKg: Prisma.Decimal;
  status: string;
  expiresAt: Date | null;
  batch: { status: string };
  product: { id: string; name: string };
  salesOrder: { id: string; orderNumber: string; status: string; responsibleId: string; customer: { id: string; name: string } };
};

const NOW = new Date("2026-09-28T16:48:00.000Z");
const HOUR = 3_600_000;
const d = (v: string) => new Prisma.Decimal(v);

const db = vi.hoisted(() => ({ reservations: [] as Reservation[], writes: [] as string[] }));

/** Evaluates the reservation where shapes the read services use (status, OR, salesOrder.status/responsibleId, expiresAt, ids). */
function reservationMatches(r: Reservation, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => {
    if (cond === undefined) return true;
    if (key === "OR") return (cond as Record<string, unknown>[]).some((c) => reservationMatches(r, c));
    if (key === "salesOrder") {
      const c = cond as { status?: { in: string[] }; responsibleId?: string };
      return (!c.status || c.status.in.includes(r.salesOrder.status)) && (c.responsibleId === undefined || r.salesOrder.responsibleId === c.responsibleId);
    }
    if (key === "expiresAt") {
      if (cond === null) return r.expiresAt === null;
      return r.expiresAt !== null && r.expiresAt > (cond as { gt: Date }).gt;
    }
    if (key === "batch") return r.batch.status === (cond as { status: string }).status;
    const value = (r as unknown as Record<string, unknown>)[key];
    if (cond !== null && typeof cond === "object" && "not" in (cond as object)) return value !== (cond as { not: unknown }).not;
    return value === cond;
  });
}

vi.mock("@/lib/db/prisma", () => {
  // Every write method records itself; the read tests assert the list stays empty.
  const writer = (model: string) =>
    Object.fromEntries(["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"].map((m) => [m, async () => {
      db.writes.push(`${model}.${m}`);
      return { count: 0 };
    }]));
  const movements = [
    { batchId: "b1", fromWarehouseId: null, toWarehouseId: "w1", quantityKg: new Prisma.Decimal("1000"), type: "RECEIPT", batch: { productId: "p1", status: "AVAILABLE", batchNumber: "B-1" }, fromWarehouse: null, toWarehouse: { id: "w1", code: "WH-KYIV", name: "Kyiv", isActive: true } },
  ];
  return {
    prisma: {
      $transaction: async () => {
        db.writes.push("$transaction");
        return [];
      },
      stockReservation: { findMany: async ({ where }: { where?: Record<string, unknown> } = {}) => db.reservations.filter((r) => reservationMatches(r, where)), ...writer("stockReservation") },
      stockMovement: { findMany: async () => movements, ...writer("stockMovement") },
      product: { findMany: async () => [{ id: "p1", sku: "SKU-1", name: "Product" }], ...writer("product") },
      warehouse: { findMany: async () => [{ id: "w1", code: "WH-KYIV", name: "Kyiv", isActive: true }] },
      batch: { findMany: async () => [{ id: "b1", batchNumber: "B-1", productId: "p1", status: "AVAILABLE", expiryDate: null, product: { id: "p1", sku: "SKU-1", name: "Product" } }] },
      salesOrder: { findMany: async () => [], count: async () => 0, ...writer("salesOrder") },
      customer: { findMany: async () => [], ...writer("customer") },
      receivable: { findMany: async () => [], ...writer("receivable") },
      user: { findMany: async () => [] },
      auditLog: writer("auditLog"),
    },
  };
});

import { SalesWorkspace } from "@/components/sales/sales-workspace";
import { getInventoryStatus } from "@/lib/services/dashboard/get-inventory-status";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getBatchWarehouseAvailability } from "@/lib/services/sales/get-batch-warehouse-availability";
import { getStockAvailability } from "@/lib/services/sales/get-stock-availability";
import { getStockByWarehouse } from "@/lib/services/warehouse/get-stock-by-warehouse";

let seq = 0;
function reservation(orderStatus: string, kg: string, expiresAt: Date | null, status = "ACTIVE"): Reservation {
  seq += 1;
  return {
    id: `r${seq}`,
    productId: "p1",
    batchId: "b1",
    warehouseId: "w1",
    quantityKg: d(kg),
    status,
    expiresAt,
    batch: { status: "AVAILABLE" },
    product: { id: "p1", name: "Product" },
    salesOrder: { id: `o${seq}`, orderNumber: `SO-${seq}`, status: orderStatus, responsibleId: "owner", customer: { id: "c1", name: "Customer" } },
  };
}
const past = new Date(NOW.getTime() - 2 * HOUR);
const future = new Date(NOW.getTime() + 6 * HOUR);
const salesReserved = async () => (await getStockAvailability(NOW)).reduce((s, p) => s + Number(p.activeReservedKg), 0);

beforeEach(() => {
  seq = 0;
  db.writes = [];
  db.reservations = [];
});

describe("effective-active reservations (read side, no writes)", () => {
  it("expired CONFIRMED ACTIVE does not count as reserved", async () => {
    db.reservations = [reservation("CONFIRMED", "200", past)];
    expect(await salesReserved()).toBe(0);
  });

  it("future CONFIRMED ACTIVE counts", async () => {
    db.reservations = [reservation("CONFIRMED", "100", future)];
    expect(await salesReserved()).toBe(100);
  });

  it("PROCESSING ACTIVE counts even when expiresAt < now", async () => {
    db.reservations = [reservation("PROCESSING", "300", past)];
    expect(await salesReserved()).toBe(300);
  });

  it("READY ACTIVE counts even when expiresAt < now", async () => {
    db.reservations = [reservation("READY", "400", past)];
    expect(await salesReserved()).toBe(400);
  });

  it("non-ACTIVE reservations never count; a reservation without TTL counts", async () => {
    db.reservations = [
      reservation("CONFIRMED", "70", future, "EXPIRED"),
      reservation("CANCELLED", "80", future, "RELEASED"),
      reservation("SHIPPED", "90", future, "CONSUMED"),
      reservation("CONFIRMED", "50", null),
    ];
    expect(await salesReserved()).toBe(50);
  });

  it("dashboard and /sales return the same reserved total for the same fixture", async () => {
    db.reservations = [
      reservation("CONFIRMED", "100", future),
      reservation("CONFIRMED", "200", past),
      reservation("PROCESSING", "300", past),
      reservation("READY", "400", past),
    ];
    const sales = await salesReserved();
    expect(sales).toBe(800); // 100 + 300 + 400 — the elapsed CONFIRMED 200 kg excluded
    const inventory = await getInventoryStatus(NOW);
    expect(inventory.value).toBe("1000");
    expect(inventory.segments.find((s) => s.key === "reserved")!.pct).toBe(Math.round((sales / 1000) * 100)); // 80 %
    // Warehouse stock and the reservation form use the same rule.
    const warehouse = await getStockByWarehouse(NOW);
    expect(JSON.stringify(warehouse)).toContain('"800"');
    const [availability] = await getBatchWarehouseAvailability("p1", NOW);
    expect(Number(availability.availableKg)).toBe(1000 - 800);
    expect(db.writes).toEqual([]);
  });
});

describe("opening /sales is read only", () => {
  it("rendering the Sales workspace performs zero writes, even with elapsed CONFIRMED reservations", async () => {
    db.reservations = [reservation("CONFIRMED", "200", past), reservation("PROCESSING", "300", past)];
    const html = renderToStaticMarkup(
      await SalesWorkspace({
        userId: "owner",
        permissionCodes: ["sales.orders.read", "customers.read", "inventory.stock.read", "sales.reservations.read", "finance.receivables.read"],
        readScope: "all",
        locale: "en",
        dictionary: getDictionary("en"),
      }),
    );
    expect(html).toContain(getDictionary("en").sales.workspace.kpi.reserved);
    expect(db.writes).toEqual([]);
    expect(db.reservations.map((r) => r.status)).toEqual(["ACTIVE", "ACTIVE"]); // nothing flipped to EXPIRED
  });

  it("no page or component (render path) calls expireStockReservations", () => {
    const root = path.resolve(import.meta.dirname, "../..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name)) files.push(full);
      }
    };
    walk(path.join(root, "app"));
    walk(path.join(root, "components"));
    for (const file of files) expect(readFileSync(file, "utf8"), file).not.toContain("expireStockReservations");
  });
});
