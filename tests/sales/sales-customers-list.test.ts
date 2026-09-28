import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  receivableFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    customer: { findMany: m.findMany, count: m.count },
    receivable: { findMany: m.receivableFindMany },
  },
}));

import { listSalesCustomers } from "@/lib/services/sales/list-sales-customers";

beforeEach(() => {
  vi.clearAllMocks();
  m.findMany.mockResolvedValue([]);
  m.count.mockResolvedValue(0);
  m.receivableFindMany.mockResolvedValue([]);
});

describe("listSalesCustomers ordering", () => {
  it("orders by name asc, then id asc (names aren't unique)", async () => {
    await listSalesCustomers("user-1", { page: 3, limit: 20 });
    expect(m.findMany.mock.calls[0][0].orderBy).toEqual([{ name: "asc" }, { id: "asc" }]);
  });

  it("keeps the same skip/take pagination", async () => {
    await listSalesCustomers("user-1", { page: 3, limit: 20 });
    expect(m.findMany.mock.calls[0][0]).toMatchObject({ skip: 40, take: 20 });

    vi.clearAllMocks();
    m.findMany.mockResolvedValue([]);
    m.count.mockResolvedValue(0);
    await listSalesCustomers("user-1");
    expect(m.findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 20 });
  });
});

describe("listSalesCustomers — active orders count", () => {
  it("counts only CONFIRMED / PROCESSING / READY orders per customer (DRAFT excluded)", async () => {
    await listSalesCustomers("user-1");
    const where = m.findMany.mock.calls[0][0].select._count.select.salesOrders.where;
    expect(where).toEqual({ status: { in: ["CONFIRMED", "PROCESSING", "READY"] } });
    expect(where.status.in).not.toContain("DRAFT");
  });

  it("returns the database's filtered count unchanged", async () => {
    m.findMany.mockResolvedValue([
      {
        id: "c1", code: "CUST-001", name: "Customer", status: "ACTIVE", contactPerson: null, phone: null, email: null,
        lastContactAt: null, lastPurchaseAt: null, nextActionAt: null, creditLimit: null, paymentTermDays: 0,
        responsible: null, _count: { salesOrders: 3 },
      },
    ]);
    m.count.mockResolvedValue(1);
    const result = await listSalesCustomers("user-1");
    expect(result.items[0].activeOrdersCount).toBe(3);
  });
});
