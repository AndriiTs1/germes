import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/lib/generated/prisma/client";

import { createFakePrisma, emptyFakeStockDb, type FakeStockDb } from "./fake-stock-db";

const state = vi.hoisted(() => ({ db: null as unknown as FakeStockDb }));

vi.mock("@/lib/db/prisma", () => ({
  get prisma() {
    return createFakePrisma(state.db);
  },
}));

import { getInventoryStatus } from "@/lib/services/dashboard/get-inventory-status";
import { getProcurementNeeds } from "@/lib/services/dashboard/get-procurement-needs";
import { getProductStockSummaries } from "@/lib/services/products/get-product-stock-summaries";
import { listProductCategories, listProducts, PRODUCT_PAGE_SIZE } from "@/lib/services/products/list-products";
import { getStockAvailability } from "@/lib/services/sales/get-stock-availability";
import { getStockByWarehouse } from "@/lib/services/warehouse/get-stock-by-warehouse";

const NOW = new Date("2026-10-03T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const d = (value: string) => new Prisma.Decimal(value);

let movementSeq = 0;
function product(id: string, opts: { sku?: string; name?: string; category?: string | null; isActive?: boolean } = {}) {
  state.db.products.push({
    id,
    sku: opts.sku ?? id.toUpperCase(),
    name: opts.name ?? `Product ${id}`,
    category: opts.category === undefined ? "Pork" : opts.category,
    isActive: opts.isActive ?? true,
  });
}
function batch(id: string, productId: string, status = "AVAILABLE") {
  state.db.batches.push({ id, productId, status });
}
function move(type: string, batchId: string, kg: string, from: string | null, to: string | null) {
  movementSeq += 1;
  state.db.movements.push({ id: `m${movementSeq}`, type, batchId, fromWarehouseId: from, toWarehouseId: to, quantityKg: d(kg) });
}
const receipt = (batchId: string, kg: string, to = "w1") => move("RECEIPT", batchId, kg, null, to);
const shipment = (batchId: string, kg: string, from = "w1") => move("SHIPMENT", batchId, kg, from, null);
const transfer = (batchId: string, kg: string, from = "w1", to = "w2") => move("TRANSFER", batchId, kg, from, to);
function reserve(
  productId: string,
  kg: string,
  opts: { batchId?: string | null; warehouseId?: string | null; status?: string; expiresAt?: Date | null; orderStatus?: string } = {},
) {
  state.db.reservations.push({
    productId,
    batchId: opts.batchId === undefined ? null : opts.batchId,
    warehouseId: opts.warehouseId === undefined ? "w1" : opts.warehouseId,
    quantityKg: d(kg),
    status: opts.status ?? "ACTIVE",
    expiresAt: opts.expiresAt === undefined ? null : opts.expiresAt,
    orderStatus: opts.orderStatus ?? "CONFIRMED",
  });
}

async function summary(productId: string) {
  return (await getProductStockSummaries([productId], NOW))[productId];
}

beforeEach(() => {
  movementSeq = 0;
  state.db = emptyFakeStockDb();
  state.db.warehouses = [
    { id: "w1", code: "WH-1", name: "Kyiv", isActive: true },
    { id: "w2", code: "WH-2", name: "Lviv", isActive: true },
  ];
});

describe("listProducts — master catalog", () => {
  it("lists a product with zero stock and a product with no batches at all", async () => {
    product("a");
    product("b");
    batch("b1", "a");
    receipt("b1", "10");
    shipment("b1", "10");
    const result = await listProducts();
    expect(result.items.map((p) => p.id)).toEqual(["a", "b"]);
    expect(result.totalCount).toBe(2);
  });

  it("status: default lists active and inactive; active / inactive filter by isActive", async () => {
    product("a", { isActive: true });
    product("b", { isActive: false });
    expect((await listProducts()).items.map((p) => p.id)).toEqual(["a", "b"]);
    expect((await listProducts({ isActive: true })).items.map((p) => p.id)).toEqual(["a"]);
    const inactive = await listProducts({ isActive: false });
    expect(inactive.items).toEqual([{ id: "b", sku: "B", name: "Product b", category: "Pork", isActive: false }]);
    expect(inactive.totalCount).toBe(1);
    expect(inactive.allCount).toBe(2);
  });

  it("search matches SKU case-insensitively", async () => {
    product("a", { sku: "PORK-001", name: "Шия свиняча" });
    product("b", { sku: "BEEF-001", name: "Серце яловиче" });
    expect((await listProducts({ search: "pork-0" })).items.map((p) => p.sku)).toEqual(["PORK-001"]);
  });

  it("search matches the name case-insensitively and is trimmed", async () => {
    product("a", { sku: "PORK-001", name: "Шия свиняча" });
    product("b", { sku: "BEEF-001", name: "Серце яловиче" });
    expect((await listProducts({ search: "  серце  " })).items.map((p) => p.sku)).toEqual(["BEEF-001"]);
  });

  it("category filter uses the exact stored value", async () => {
    product("a", { category: "Свинина" });
    product("b", { category: "Яловичина" });
    product("c", { category: null });
    const result = await listProducts({ category: "Яловичина" });
    expect(result.items.map((p) => p.id)).toEqual(["b"]);
    expect(result.totalCount).toBe(1);
  });

  it("paginates server-side by SKU with a 50-row default page and a correct total", async () => {
    expect(PRODUCT_PAGE_SIZE).toBe(50);
    for (let i = 1; i <= 120; i += 1) product(`p${i}`, { sku: `SKU-${String(i).padStart(3, "0")}` });
    const first = await listProducts();
    expect(first.items).toHaveLength(50);
    expect(first.items[0].sku).toBe("SKU-001");
    expect(first).toMatchObject({ totalCount: 120, allCount: 120, page: 1, pageCount: 3 });
    const last = await listProducts({ page: 3 });
    expect(last.items.map((p) => p.sku)).toEqual(Array.from({ length: 20 }, (_, i) => `SKU-${101 + i}`));
    const seen = new Set([...first.items, ...(await listProducts({ page: 2 })).items, ...last.items].map((p) => p.id));
    expect(seen.size).toBe(120);
  });

  it("the current 42-SKU demo catalog fits on one page", async () => {
    for (let i = 1; i <= 42; i += 1) product(`p${i}`, { sku: `SKU-${String(i).padStart(2, "0")}` });
    const result = await listProducts();
    expect(result.items).toHaveLength(42);
    expect(result.pageCount).toBe(1);
  });

  it("total count follows the filters, allCount does not", async () => {
    product("a", { category: "Pork" });
    product("b", { category: "Beef" });
    product("c", { category: "Beef", isActive: false });
    const result = await listProducts({ category: "Beef", isActive: true });
    expect(result).toMatchObject({ totalCount: 1, allCount: 3, pageCount: 1 });
  });

  it("categories are the distinct non-empty stored values", async () => {
    product("a", { category: "Pork" });
    product("b", { category: "Pork" });
    product("c", { category: "Beef" });
    product("d", { category: null });
    expect((await listProductCategories()).sort()).toEqual(["Beef", "Pork"]);
  });
});

describe("getProductStockSummaries — canonical availability", () => {
  beforeEach(() => {
    product("a");
    batch("b1", "a");
  });

  it("inbound movement adds stock", async () => {
    receipt("b1", "100");
    expect(await summary("a")).toEqual({ onHandKg: "100", notSellableKg: "0", reservedKg: "0", availableKg: "100" });
  });

  it("outbound movements (shipment, write-off) subtract stock", async () => {
    receipt("b1", "100");
    shipment("b1", "30");
    move("WRITE_OFF", "b1", "5", "w1", null);
    expect(await summary("a")).toMatchObject({ onHandKg: "65", availableKg: "65" });
  });

  it("a transfer between warehouses keeps the company total unchanged", async () => {
    receipt("b1", "100");
    transfer("b1", "40");
    transfer("b1", "10", "w2", "w1");
    expect(await summary("a")).toMatchObject({ onHandKg: "100", availableKg: "100" });
  });

  it("an adjustment follows its own from/to direction", async () => {
    receipt("b1", "100");
    move("ADJUSTMENT", "b1", "3", null, "w1");
    move("ADJUSTMENT", "b1", "1.5", "w2", null);
    expect(await summary("a")).toMatchObject({ onHandKg: "101.5" });
  });

  it("effective-active reservations are subtracted from available, not from on hand", async () => {
    receipt("b1", "100");
    reserve("a", "25", { batchId: "b1", expiresAt: new Date(NOW.getTime() + HOUR) });
    reserve("a", "5"); // product-level hold without a batch
    expect(await summary("a")).toEqual({ onHandKg: "100", notSellableKg: "0", reservedKg: "30", availableKg: "70" });
  });

  it("released / expired / consumed and TTL-elapsed CONFIRMED reservations do not count; PROCESSING keeps holding", async () => {
    receipt("b1", "100");
    reserve("a", "10", { status: "RELEASED" });
    reserve("a", "11", { status: "EXPIRED" });
    reserve("a", "12", { status: "CONSUMED" });
    reserve("a", "13", { expiresAt: new Date(NOW.getTime() - HOUR) });
    reserve("a", "20", { expiresAt: new Date(NOW.getTime() - HOUR), orderStatus: "PROCESSING" });
    expect(await summary("a")).toMatchObject({ reservedKg: "20", availableKg: "80" });
  });

  it("no stock at all: every value is zero", async () => {
    expect(await summary("a")).toEqual({ onHandKg: "0", notSellableKg: "0", reservedKg: "0", availableKg: "0" });
  });

  it("over-reservation stays visible as a negative available value", async () => {
    receipt("b1", "10");
    reserve("a", "15", { batchId: "b1" });
    expect(await summary("a")).toMatchObject({ availableKg: "-5" });
  });

  it.each(["QUARANTINE", "BLOCKED", "DEPLETED"])(
    "%s batch: counted on hand, never available, and its reservation is not subtracted",
    async (status) => {
      receipt("b1", "100");
      batch("b2", "a", status);
      receipt("b2", "40");
      reserve("a", "7", { batchId: "b2" });
      expect(await summary("a")).toEqual({ onHandKg: "140", notSellableKg: "40", reservedKg: "0", availableKg: "100" });
    },
  );

  it("loads stock only for the requested products, in a fixed number of queries (no N+1)", async () => {
    for (let i = 0; i < 30; i += 1) {
      product(`x${i}`);
      batch(`xb${i}`, `x${i}`);
      receipt(`xb${i}`, "1");
    }
    state.db.calls = [];
    const ids = Array.from({ length: 30 }, (_, i) => `x${i}`);
    const result = await getProductStockSummaries(ids, NOW);
    expect(Object.keys(result).sort()).toEqual([...ids].sort());
    expect(state.db.calls.sort()).toEqual(["batch.findMany", "stockMovement.groupBy", "stockReservation.findMany"]);
    expect(state.db.calls).not.toContain("stockMovement.findMany");
  });

  it("an empty page performs no stock queries", async () => {
    state.db.calls = [];
    expect(await getProductStockSummaries([], NOW)).toEqual({});
    expect(state.db.calls).toEqual([]);
  });
});

describe("one product, the same numbers on Products, Sales, Warehouse and Command Center", () => {
  beforeEach(() => {
    product("a", { sku: "A" });
    product("b", { sku: "B" });
    product("c", { sku: "C" });
    batch("a1", "a");
    batch("a2", "a", "QUARANTINE");
    batch("b1", "b");
    receipt("a1", "500");
    receipt("a2", "60", "w2");
    transfer("a1", "200");
    shipment("a1", "50", "w2");
    move("ADJUSTMENT", "a1", "4", "w1", null);
    receipt("b1", "80");
    transfer("b1", "80");
    reserve("a", "100", { batchId: "a1", warehouseId: "w1" });
    reserve("a", "30", { batchId: null, warehouseId: null });
    reserve("b", "20", { batchId: "b1", warehouseId: "w2", expiresAt: new Date(NOW.getTime() + HOUR) });
    reserve("b", "999", { status: "RELEASED" });
  });

  it("Products = Sales (getStockAvailability) = Warehouse total (getStockByWarehouse)", async () => {
    const products = await getProductStockSummaries(["a", "b", "c"], NOW);
    const sales = await getStockAvailability(NOW);
    const warehouse = await getStockByWarehouse(NOW);

    for (const id of ["a", "b", "c"]) {
      const s = sales.find((row) => row.productId === id)!;
      const w = warehouse.rows.find((row) => row.productId === id)!.total;
      expect(products[id].onHandKg).toBe(s.physicalOnHandKg);
      expect(products[id].reservedKg).toBe(s.activeReservedKg);
      expect(products[id].availableKg).toBe(s.availableKg);
      expect(products[id].onHandKg).toBe(w.onHandKg);
      expect(products[id].reservedKg).toBe(w.reservedKg);
      expect(products[id].availableKg).toBe(w.availableKg);
    }
    // 500 + 60 (quarantine) + 0 (transfer) − 50 − 4
    expect(products.a).toEqual({ onHandKg: "506", notSellableKg: "60", reservedKg: "130", availableKg: "316" });
    expect(products.b).toEqual({ onHandKg: "80", notSellableKg: "0", reservedKg: "20", availableKg: "60" });
    expect(products.c).toEqual({ onHandKg: "0", notSellableKg: "0", reservedKg: "0", availableKg: "0" });
  });

  it("Command Center lowest-stock card shows the same on-hand per product", async () => {
    const products = await getProductStockSummaries(["a", "b", "c"], NOW);
    const needs = await getProcurementNeeds();
    for (const item of needs.items) {
      const id = state.db.products.find((p) => p.sku === item.sku)!.id;
      expect(item.stockKg).toBe(Math.round(Number(products[id].onHandKg)));
    }
    expect(needs.items.map((item) => [item.sku, item.stockKg])).toEqual([["C", 0], ["B", 80], ["A", 506]]);
  });

  it("Command Center inventory ring total equals the sum of on-hand across products", async () => {
    const products = await getProductStockSummaries(["a", "b", "c"], NOW);
    const total = Object.values(products).reduce((sum, row) => sum + Number(row.onHandKg), 0);
    expect((await getInventoryStatus(NOW)).value).toBe(String(total));
    expect(total).toBe(586);
  });
});
