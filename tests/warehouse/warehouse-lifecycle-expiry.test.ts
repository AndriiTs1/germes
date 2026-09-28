import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/lib/generated/prisma/client";

type Row = Record<string, unknown> & { id: string };
type Tables = {
  salesOrder: Row[];
  salesOrderItem: Row[];
  stockReservation: Row[];
  batch: Row[];
  warehouse: Row[];
  stockMovement: Row[];
  receivable: Row[];
  auditLog: Row[];
};

const db = vi.hoisted(() => ({
  tables: {} as Tables,
  /** Runs right before salesOrder.updateMany (simulates a concurrent change). */
  beforeOrderUpdate: undefined as undefined | (() => void),
  nextId: 1,
}));

/** Evaluates the where shapes the warehouse lifecycle services use. */
function matches(row: Row, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, expected]) => {
    if (key === "OR") return (expected as Record<string, unknown>[]).some((clause) => matches(row, clause));
    const actual = row[key];
    if (expected === null) return actual === null;
    if (expected instanceof Date) return actual instanceof Date && actual.getTime() === expected.getTime();
    if (typeof expected === "object") {
      const ops = expected as Record<string, unknown>;
      if ("in" in ops && !(ops.in as unknown[]).includes(actual)) return false;
      if ("not" in ops && (ops.not === null ? actual === null : actual === ops.not)) return false;
      if ("lte" in ops && !(actual instanceof Date && actual <= (ops.lte as Date))) return false;
      if ("gt" in ops && !(actual instanceof Date && actual > (ops.gt as Date))) return false;
      return true;
    }
    return actual === expected;
  });
}

vi.mock("@/lib/db/prisma", () => {
  const table = (name: keyof Tables) => ({
    findFirst: async ({ where }: { where?: Record<string, unknown> }) =>
      db.tables[name].find((row) => matches(row, where)) ?? null,
    findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
      db.tables[name].filter((row) => matches(row, where)),
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      if (name === "salesOrder") db.beforeOrderUpdate?.();
      const targets = db.tables[name].filter((row) => matches(row, where));
      for (const row of targets) Object.assign(row, data);
      return { count: targets.length };
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `${name}-${db.nextId++}`, ...data };
      db.tables[name].push(row);
      return row;
    },
  });
  const tx = {
    salesOrder: table("salesOrder"),
    salesOrderItem: table("salesOrderItem"),
    stockReservation: table("stockReservation"),
    batch: table("batch"),
    warehouse: table("warehouse"),
    stockMovement: table("stockMovement"),
    receivable: table("receivable"),
    auditLog: table("auditLog"),
  };
  return {
    prisma: {
      // Rollback semantics: any throw restores the snapshot taken at the start.
      $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => {
        const snapshot = Object.fromEntries(
          Object.entries(db.tables).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]),
        ) as Tables;
        try {
          return await callback(tx);
        } catch (error) {
          db.tables = snapshot;
          throw error;
        }
      },
    },
  };
});

import { markSalesOrderReady } from "@/lib/services/warehouse/mark-sales-order-ready";
import { shipSalesOrder } from "@/lib/services/warehouse/ship-sales-order";
import { startSalesOrderProcessing } from "@/lib/services/warehouse/start-sales-order-processing";

const OPERATOR = "warehouse-1";
const HOUR = 60 * 60 * 1000;
const ELAPSED = () => new Date(Date.now() - 2 * HOUR);
const FUTURE = () => new Date(Date.now() + 2 * HOUR);

function setup(orderStatus: string, reservation: { status?: string; expiresAt?: Date | null } = {}) {
  db.nextId = 1;
  db.beforeOrderUpdate = undefined;
  db.tables = {
    salesOrder: [
      {
        id: "order-1",
        orderNumber: "SO-2026-001",
        status: orderStatus,
        customerId: "customer-1",
        currency: "UAH",
        customer: { paymentTermDays: 0 },
      },
    ],
    salesOrderItem: [
      {
        id: "item-1",
        salesOrderId: "order-1",
        productId: "product-1",
        quantityKg: new Prisma.Decimal("100"),
        pricePerKg: new Prisma.Decimal("50"),
      },
    ],
    stockReservation: [
      {
        id: "res-1",
        salesOrderId: "order-1",
        salesOrderItemId: "item-1",
        productId: "product-1",
        batchId: "batch-1",
        warehouseId: "wh-1",
        quantityKg: new Prisma.Decimal("100"),
        status: reservation.status ?? "ACTIVE",
        expiresAt: reservation.expiresAt === undefined ? ELAPSED() : reservation.expiresAt,
      },
    ],
    batch: [{ id: "batch-1", productId: "product-1", status: "AVAILABLE" }],
    warehouse: [{ id: "wh-1", isActive: true }],
    stockMovement: [
      { id: "mv-0", batchId: "batch-1", fromWarehouseId: null, toWarehouseId: "wh-1", quantityKg: new Prisma.Decimal("500") },
    ],
    receivable: [],
    auditLog: [],
  };
}

const order = () => db.tables.salesOrder[0];
const reservation = () => db.tables.stockReservation[0];
const shipments = () => db.tables.stockMovement.filter((movement) => movement.type === "SHIPMENT");

beforeEach(() => setup("CONFIRMED"));

describe("CONFIRMED → PROCESSING keeps the TTL", () => {
  it("1. an elapsed ACTIVE reservation blocks processing; nothing persists", async () => {
    setup("CONFIRMED", { expiresAt: ELAPSED() });
    expect(await startSalesOrderProcessing(OPERATOR, "order-1")).toEqual({
      ok: false,
      error: "FULFILLMENT_NOT_READY",
    });
    expect(order().status).toBe("CONFIRMED");
    expect(reservation().status).toBe("ACTIVE"); // the in-transaction expiry was rolled back
    expect(db.tables.auditLog).toHaveLength(0);
  });

  it("a not-yet-elapsed reservation still lets the order into PROCESSING", async () => {
    setup("CONFIRMED", { expiresAt: FUTURE() });
    expect(await startSalesOrderProcessing(OPERATOR, "order-1")).toEqual({ ok: true });
    expect(order().status).toBe("PROCESSING");
  });
});

describe("PROCESSING → READY ignores the elapsed TTL", () => {
  it("2. ACTIVE reservation with expiresAt in the past → READY; expiresAt untouched", async () => {
    const expiresAt = ELAPSED();
    setup("PROCESSING", { expiresAt });
    expect(await markSalesOrderReady(OPERATOR, "order-1")).toEqual({ ok: true });
    expect(order().status).toBe("READY");
    expect(reservation().status).toBe("ACTIVE");
    expect(reservation().expiresAt).toEqual(expiresAt);
  });

  it("5. an EXPIRED-status reservation still blocks READY", async () => {
    setup("PROCESSING", { status: "EXPIRED" });
    expect(await markSalesOrderReady(OPERATOR, "order-1")).toEqual({ ok: false, error: "FULFILLMENT_NOT_READY" });
    expect(order().status).toBe("PROCESSING");
    expect(db.tables.auditLog).toHaveLength(0);
  });
});

describe("READY → SHIPPED ignores the elapsed TTL", () => {
  it("3 + 4. ACTIVE reservation with expiresAt in the past ships and becomes CONSUMED", async () => {
    const expiresAt = ELAPSED();
    setup("READY", { expiresAt });
    expect(await shipSalesOrder(OPERATOR, "order-1")).toEqual({ ok: true });
    expect(order().status).toBe("SHIPPED");
    expect(reservation().status).toBe("CONSUMED");
    expect(reservation().expiresAt).toEqual(expiresAt);
    expect(shipments()).toHaveLength(1);
    expect(shipments()[0]).toMatchObject({ batchId: "batch-1", fromWarehouseId: "wh-1", toWarehouseId: null });
    expect(db.tables.receivable).toHaveLength(1);
  });

  it.each(["RELEASED", "CONSUMED", "EXPIRED"])(
    "6 + 7. a %s reservation cannot be shipped; nothing persists",
    async (status) => {
      setup("READY", { status });
      expect(await shipSalesOrder(OPERATOR, "order-1")).toEqual({ ok: false, error: "FULFILLMENT_NOT_READY" });
      expect(order().status).toBe("READY");
      expect(reservation().status).toBe(status);
      expect(shipments()).toHaveLength(0);
      expect(db.tables.receivable).toHaveLength(0);
      expect(db.tables.auditLog).toHaveLength(0);
    },
  );

  it("8. shipping twice: the second attempt is refused, one shipment only", async () => {
    setup("READY");
    expect(await shipSalesOrder(OPERATOR, "order-1")).toEqual({ ok: true });
    expect(await shipSalesOrder(OPERATOR, "order-1")).toEqual({ ok: false, error: "ORDER_UNAVAILABLE" });
    expect(shipments()).toHaveLength(1);
    expect(db.tables.receivable).toHaveLength(1);
  });

  it("9. a concurrent shipment committing first rolls back all partial writes", async () => {
    setup("READY");
    db.beforeOrderUpdate = () => {
      order().status = "SHIPPED";
    };
    expect(await shipSalesOrder(OPERATOR, "order-1")).toEqual({ ok: false, error: "ORDER_UNAVAILABLE" });
    expect(shipments()).toHaveLength(0);
    expect(db.tables.receivable).toHaveLength(0);
    expect(db.tables.auditLog).toHaveLength(0);
    expect(reservation().status).toBe("ACTIVE");
  });
});
