import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/lib/generated/prisma/client";

type Item = { quantityKg: Prisma.Decimal; pricePerKg: Prisma.Decimal };
type Order = { status: string; responsibleId: string | null; currency: string; items: Item[] };
type StatusWhere = { in?: string[]; notIn?: string[]; not?: string } | string | undefined;

const db = vi.hoisted(() => ({ orders: [] as Order[] }));

function statusMatches(status: string, where: StatusWhere) {
  if (where === undefined) return true;
  if (typeof where === "string") return status === where;
  if (where.in) return where.in.includes(status);
  if (where.notIn) return !where.notIn.includes(status);
  if (where.not) return status !== where.not;
  return true;
}

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    salesOrder: {
      findMany: async ({ where }: { where?: { status?: StatusWhere } } = {}) =>
        db.orders.filter((o) => statusMatches(o.status, where?.status)),
    },
    user: {
      findMany: async () => ["m1", "m2", "m3"].map((id) => ({ id, name: `Manager ${id}`, email: `${id}@example.test` })),
    },
    customer: { findMany: async () => [] },
    receivable: { findMany: async () => [] },
  },
}));

import { getSalesTeamSummary } from "@/lib/services/sales/get-sales-team-summary";

const item = (quantityKg: string, pricePerKg: string): Item => ({
  quantityKg: new Prisma.Decimal(quantityKg),
  pricePerKg: new Prisma.Decimal(pricePerKg),
});
const order = (status: string, responsibleId: string | null, currency: string, items: Item[]): Order => ({
  status,
  responsibleId,
  currency,
  items,
});
const turnoverOf = async (managerId: string) =>
  (await getSalesTeamSummary()).managers.find((m) => m.manager.id === managerId)!.turnover;

describe("team summary turnover = SHIPPED + COMPLETED only", () => {
  it.each([
    ["DRAFT", false],
    ["CONFIRMED", false],
    ["PROCESSING", false],
    ["READY", false],
    ["SHIPPED", true],
    ["COMPLETED", true],
    ["CANCELLED", false],
  ])("%s → in turnover: %s", async (status, included) => {
    db.orders = [order(status, "m1", "UAH", [item("1", "100")])];
    expect(await turnoverOf("m1")).toEqual(included ? [{ currency: "UAH", amount: "100" }] : []);
  });

  describe("mixed portfolio", () => {
    beforeEach(() => {
      db.orders = [
        // m1 UAH: every non-sale status carries a big amount that must not leak in.
        order("DRAFT", "m1", "UAH", [item("1", "1000")]),
        order("CONFIRMED", "m1", "UAH", [item("1", "2000")]),
        order("PROCESSING", "m1", "UAH", [item("1", "4000")]),
        order("READY", "m1", "UAH", [item("1", "8000")]),
        order("CANCELLED", "m1", "UAH", [item("1", "16000")]),
        order("SHIPPED", "m1", "UAH", [item("10", "2.5"), item("2", "0.125")]), // 25 + 0.25
        order("COMPLETED", "m1", "UAH", [item("3.5", "100")]), // 350
        order("SHIPPED", "m1", "EUR", [item("1", "10")]),
        // m2
        order("SHIPPED", "m2", "UAH", [item("100", "1.5")]), // 150
        order("COMPLETED", "m2", "EUR", [item("2", "7.25")]), // 14.5
        order("DRAFT", "m2", "EUR", [item("1", "999")]),
        // m3: nothing sold yet
        order("CONFIRMED", "m3", "UAH", [item("1", "500")]),
        // no manager
        order("SHIPPED", null, "UAH", [item("5", "2")]), // 10
      ];
    });

    it("per manager by SalesOrder.responsibleId, quantityKg × pricePerKg, currencies kept apart", async () => {
      const summary = await getSalesTeamSummary();
      const byManager = Object.fromEntries(summary.managers.map((m) => [m.manager.id, m.turnover]));
      expect(byManager).toEqual({
        m1: [
          { currency: "EUR", amount: "10" },
          { currency: "UAH", amount: "375.25" },
        ],
        m2: [
          { currency: "EUR", amount: "14.5" },
          { currency: "UAH", amount: "150" },
        ],
        m3: [],
      });
      expect(summary.outsideTeam.turnover).toEqual([{ currency: "UAH", amount: "10" }]);
    });

    it("company turnover = managers + outsideTeam, per currency (no FX)", async () => {
      const summary = await getSalesTeamSummary();
      expect(summary.total.turnover).toEqual([
        { currency: "EUR", amount: "24.5" },
        { currency: "UAH", amount: "535.25" },
      ]);
    });

    it("active orders are unaffected (still CONFIRMED / PROCESSING / READY)", async () => {
      const summary = await getSalesTeamSummary();
      expect(summary.total.activeOrderCount).toBe(4);
      const byManager = Object.fromEntries(summary.managers.map((m) => [m.manager.id, m.activeOrderCount]));
      expect(byManager).toEqual({ m1: 3, m2: 0, m3: 1 });
    });
  });
});
