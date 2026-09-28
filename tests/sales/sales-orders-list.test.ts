import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { salesOrder: { findMany: m.findMany, count: m.count } },
}));

import { listSalesOrders } from "@/lib/services/sales/list-sales-orders";
import { statusFilterToOptions } from "@/lib/services/sales/orders-status-filter";

const USER_ID = "user-1";

beforeEach(() => {
  vi.clearAllMocks();
  m.findMany.mockResolvedValue([]);
  m.count.mockResolvedValue(0);
});

/** The where clause listSalesOrders sent to findMany (and asserts count got the same one). */
async function whereFor(options: Parameters<typeof listSalesOrders>[1]) {
  await listSalesOrders(USER_ID, options);
  const where = m.findMany.mock.calls[0][0].where;
  expect(m.count.mock.calls[0][0].where).toEqual(where);
  return where;
}

describe("/sales/orders status tabs → listSalesOrders options", () => {
  it("1. completed = status IN [SHIPPED, COMPLETED]", async () => {
    expect((await whereFor(statusFilterToOptions("completed"))).status).toEqual({ in: ["SHIPPED", "COMPLETED"] });
  });

  it("2. completed never includes CANCELLED (or any active status)", async () => {
    const { status } = await whereFor(statusFilterToOptions("completed"));
    for (const excluded of ["CANCELLED", "DRAFT", "CONFIRMED", "PROCESSING", "READY"]) {
      expect(status.in).not.toContain(excluded);
    }
  });

  it("3. active still excludes SHIPPED, COMPLETED and CANCELLED", async () => {
    expect((await whereFor(statusFilterToOptions("active"))).status).toEqual({
      notIn: ["SHIPPED", "COMPLETED", "CANCELLED"],
    });
  });

  it("4. cancelled is exactly CANCELLED", async () => {
    expect((await whereFor(statusFilterToOptions("cancelled"))).status).toBe("CANCELLED");
  });

  it("5. all adds no status restriction", async () => {
    expect((await whereFor(statusFilterToOptions("all"))).status).toBeUndefined();
  });
});

describe("listSalesOrders", () => {
  it("6. orders by orderDate desc, then id desc (stable pages)", async () => {
    await listSalesOrders(USER_ID, { page: 2, limit: 20 });
    const args = m.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual([{ orderDate: "desc" }, { id: "desc" }]);
    expect(args).toMatchObject({ take: 20, skip: 20 });
  });

  it("7. the single-status filter still works and wins over statuses/onlyActive", async () => {
    expect((await whereFor({ status: "CANCELLED" })).status).toBe("CANCELLED");
    vi.clearAllMocks();
    m.findMany.mockResolvedValue([]);
    m.count.mockResolvedValue(0);
    expect((await whereFor({ status: "CANCELLED", statuses: ["SHIPPED"], onlyActive: true })).status).toBe("CANCELLED");
  });

  it("8. status IN reaches both findMany and count", async () => {
    await listSalesOrders(USER_ID, { statuses: ["SHIPPED", "COMPLETED"], onlyActive: true });
    expect(m.findMany.mock.calls[0][0].where.status).toEqual({ in: ["SHIPPED", "COMPLETED"] });
    expect(m.count.mock.calls[0][0].where.status).toEqual({ in: ["SHIPPED", "COMPLETED"] });
  });

  it("own scope still restricts to the current user", async () => {
    expect((await whereFor(statusFilterToOptions("completed"))).responsibleId).toBe(USER_ID);
  });
});
