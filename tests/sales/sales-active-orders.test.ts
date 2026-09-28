import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Order = { id: string; orderNumber: string; status: string; responsibleId: string; currency: string; orderDate: Date };
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
const filterOrders = (where: { status?: StatusWhere; responsibleId?: string } = {}) =>
  db.orders.filter((o) => statusMatches(o.status, where.status) && (where.responsibleId === undefined || o.responsibleId === where.responsibleId));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    salesOrder: {
      findMany: async ({ where }: { where?: { status?: StatusWhere; responsibleId?: string } } = {}) =>
        filterOrders(where)
          .sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime())
          .map((o) => ({
            ...o,
            requestedDate: null,
            shippedAt: null,
            customer: { id: "c1", name: "Customer" },
            responsible: { id: o.responsibleId, name: o.responsibleId },
            items: [],
          })),
      count: async ({ where }: { where?: { status?: StatusWhere; responsibleId?: string } } = {}) => filterOrders(where).length,
    },
    user: {
      findMany: async () => ["m1", "m2", "m3"].map((id) => ({ id, name: `Manager ${id}`, email: `${id}@example.test` })),
    },
    customer: { findMany: async () => [] },
    receivable: { findMany: async () => [] },
  },
}));
// Other /sales widgets are not under test here.
vi.mock("@/lib/services/sales/expire-stock-reservations", () => ({ expireStockReservations: async () => undefined }));
vi.mock("@/lib/services/sales/get-attention-customers", () => ({ getAttentionCustomers: async () => [] }));
vi.mock("@/lib/services/sales/get-receivable-exposure", () => ({ getReceivableExposure: async () => [] }));
vi.mock("@/lib/services/sales/get-reservations-requiring-attention", () => ({ getReservationsRequiringAttention: async () => [] }));
vi.mock("@/lib/services/sales/get-stock-availability", () => ({ getStockAvailability: async () => [] }));

import { SalesWorkspace } from "@/components/sales/sales-workspace";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { ACTIVE_SALES_ORDER_STATUSES } from "@/lib/services/sales/config";
import { getSalesTeamSummary } from "@/lib/services/sales/get-sales-team-summary";
import { listSalesOrders } from "@/lib/services/sales/list-sales-orders";

let seq = 0;
const order = (status: string, responsibleId: string): Order => {
  seq += 1;
  return { id: `o${seq}`, orderNumber: `SO-2026-${String(seq).padStart(3, "0")}`, status, responsibleId, currency: "UAH", orderDate: new Date(Date.UTC(2026, 8, seq)) };
};

beforeEach(() => {
  seq = 0;
  db.orders = [
    // m1: 2 drafts, confirmed, processing, shipped
    order("DRAFT", "m1"), order("DRAFT", "m1"), order("CONFIRMED", "m1"), order("PROCESSING", "m1"), order("SHIPPED", "m1"),
    // m2: draft, ready, ready, cancelled
    order("DRAFT", "m2"), order("READY", "m2"), order("READY", "m2"), order("CANCELLED", "m2"),
    // m3: confirmed, completed
    order("CONFIRMED", "m3"), order("COMPLETED", "m3"),
  ];
});

describe("Active Orders on /sales = CONFIRMED + PROCESSING + READY (DRAFT excluded)", () => {
  it("the shared definition matches the Owner Dashboard's", () => {
    expect([...ACTIVE_SALES_ORDER_STATUSES]).toEqual(["CONFIRMED", "PROCESSING", "READY"]);
  });

  it("listSalesOrders with the active statuses counts 5, not the 8 non-terminal orders", async () => {
    const result = await listSalesOrders("m1", { scope: "all", statuses: ACTIVE_SALES_ORDER_STATUSES, limit: 5 });
    expect(result.totalCount).toBe(5);
    expect(result.orders.every((o) => o.status !== "DRAFT")).toBe(true);
  });

  it("/sales/orders: the 'active' tab (onlyActive) is the same 5 — no drafts; 'all' still lists the drafts", async () => {
    const active = await listSalesOrders("m1", { scope: "all", onlyActive: true, limit: 50 });
    expect(active.totalCount).toBe(5);
    expect(active.orders.some((o) => o.status === "DRAFT")).toBe(false);
    const all = await listSalesOrders("m1", { scope: "all", limit: 50 });
    expect(all.orders.filter((o) => o.status === "DRAFT")).toHaveLength(3);
  });

  it("team summary: company total and every manager count only CONFIRMED / PROCESSING / READY", async () => {
    const summary = await getSalesTeamSummary();
    expect(summary.total.activeOrderCount).toBe(5);
    const byManager = Object.fromEntries(summary.managers.map((m) => [m.manager.id, m.activeOrderCount]));
    expect(byManager).toEqual({ m1: 2, m2: 2, m3: 1 });
  });

  it("the /sales page: KPI = 5 and the Active Orders card lists no draft", async () => {
    const dictionary = getDictionary("en");
    const html = renderToStaticMarkup(
      await SalesWorkspace({
        userId: "owner",
        permissionCodes: ["sales.orders.read", "customers.read"],
        readScope: "all",
        locale: "en",
        dictionary,
      }),
    );
    const label = dictionary.sales.workspace.kpi.activeOrders;
    expect(html).toContain(label);
    // KPI value: the label's card shows 5 (8 would mean drafts were counted).
    const kpiChunk = html.slice(html.indexOf(label), html.indexOf(label) + 600);
    expect(kpiChunk).toMatch(/>5</);
    expect(kpiChunk).not.toMatch(/>8</);
    const drafts = db.orders.filter((o) => o.status === "DRAFT").map((o) => o.orderNumber);
    for (const number of drafts) expect(html).not.toContain(number);
    expect(html).toContain(db.orders.find((o) => o.status === "READY")!.orderNumber);
  });
});
