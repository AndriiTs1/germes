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
