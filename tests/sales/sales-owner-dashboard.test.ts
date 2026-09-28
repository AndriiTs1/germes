import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// No DOM in this runner, so clicks can't be simulated. Instead the initial
// value of every client toggle (disclosure + "show all") is forced: false =
// the default render, true = the render after clicking open / show all.
const toggles = vi.hoisted(() => ({ forced: undefined as boolean | undefined }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: <T,>(initial: T) => actual.useState(toggles.forced === undefined ? initial : (toggles.forced as T)),
  };
});

const data = vi.hoisted(() => ({
  attention: Array.from({ length: 13 }, (_, i) => ({
    customerId: `c${i + 1}`,
    customerName: `Attention Customer ${String(i + 1).padStart(2, "0")}`,
    reasons: [{ type: "STALE_CONTACT", since: "2026-01-01T00:00:00.000Z" }],
    nextActionAt: null,
    lastContactAt: null,
    lastPurchaseAt: null,
  })),
  // Service order: expired first, then expiring soon, then active.
  reservations: [
    ...["E1", "E2"].map((id) => ({ id, state: "EXPIRED_ACTIVE" })),
    ...["S1", "S2", "S3", "S4"].map((id) => ({ id, state: "EXPIRING_SOON" })),
    ...["A1", "A2", "A3"].map((id) => ({ id, state: "ACTIVE" })),
  ].map(({ id, state }) => ({
    id,
    orderId: `o-${id}`,
    orderNumber: `SO-RES-${id}`,
    customerId: "c1",
    customerName: "Reservation Customer",
    productId: `p-${id}`,
    productName: `Reserved Product ${id}`,
    quantityKg: "10",
    status: "ACTIVE",
    expiresAt: null,
    attentionState: state,
  })),
  stock: [
    { productId: "pa", sku: "A", name: "Alpha Fine", availableKg: "100", inconsistentReservedKg: "0" },
    { productId: "pb", sku: "B", name: "Bravo Negative", availableKg: "-5", inconsistentReservedKg: "0" },
    { productId: "pc", sku: "C", name: "Charlie Inconsistent", availableKg: "50", inconsistentReservedKg: "3" },
  ].map((p) => ({ ...p, physicalOnHandKg: "100", sellableOnHandKg: "100", activeReservedKg: "0" })),
  receivables: [
    { currency: "EUR", totalOutstanding: "18000", overdueOutstanding: "6002.28", dueSoonOutstanding: "0", affectedCustomerCount: 1, affectedReceivableCount: 2 },
    { currency: "UAH", totalOutstanding: "12007343.57", overdueOutstanding: "2576133.52", dueSoonOutstanding: "100", affectedCustomerCount: 5, affectedReceivableCount: 9 },
  ],
}));

vi.mock("@/lib/services/sales/get-attention-customers", () => ({ getAttentionCustomers: async () => data.attention }));
vi.mock("@/lib/services/sales/get-reservations-requiring-attention", () => ({
  getReservationsRequiringAttention: async () => data.reservations,
}));
vi.mock("@/lib/services/sales/get-stock-availability", () => ({ getStockAvailability: async () => data.stock }));
vi.mock("@/lib/services/sales/get-receivable-exposure", () => ({ getReceivableExposure: async () => data.receivables }));
vi.mock("@/lib/services/sales/list-sales-orders", () => ({
  listSalesOrders: async () => ({
    orders: [
      {
        id: "o1",
        orderNumber: "SO-ACTIVE-1",
        status: "CONFIRMED",
        orderDate: "2026-09-01T00:00:00.000Z",
        requestedDate: null,
        shippedAt: null,
        customerId: "c1",
        customerName: "Order Customer",
        currency: "UAH",
        totalValue: "100",
        totalQuantityKg: "1",
        itemCount: 1,
        responsible: null,
      },
    ],
    nextCursor: null,
    totalCount: 44,
    page: 1,
    pageCount: 9,
  }),
}));
vi.mock("@/lib/services/sales/get-sales-team-summary", () => {
  const metrics = (turnover: { currency: string; amount: string }[], receivables: typeof data.receivables) => ({
    customerCount: 41,
    activeOrderCount: 44,
    attentionCount: 13,
    turnover,
    receivables: receivables.map(({ currency, totalOutstanding, overdueOutstanding }) => ({ currency, totalOutstanding, overdueOutstanding })),
  });
  const twoCurrencies = [
    { currency: "EUR", amount: "140007.67" },
    { currency: "UAH", amount: "27028000" },
  ];
  return {
    getSalesTeamSummary: async () => ({
      managers: [
        { manager: { id: "m1", name: "Oksana", email: "m1@x" }, ...metrics(twoCurrencies, data.receivables) },
        { manager: { id: "m2", name: "Iryna", email: "m2@x" }, ...metrics([{ currency: "UAH", amount: "500" }], []) },
      ],
      outsideTeam: metrics([], []),
      total: metrics(twoCurrencies, data.receivables),
    }),
  };
});

import { SalesWorkspace } from "@/components/sales/sales-workspace";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { SalesReadScope } from "@/lib/services/sales/read-scope";

const dictionary = getDictionary("en");
const ALL_READ = [
  "customers.read",
  "sales.orders.read",
  "inventory.stock.read",
  "sales.reservations.read",
  "finance.receivables.read",
];
const OWNER_PERMISSIONS = [...ALL_READ, "workspace.warehouse.access", "finance.dashboard.read"];

async function render(readScope: SalesReadScope, permissionCodes = OWNER_PERMISSIONS) {
  return renderToStaticMarkup(
    await SalesWorkspace({ userId: "u1", permissionCodes, readScope, locale: "en", dictionary }),
  );
}
const attentionName = (n: number) => `Attention Customer ${String(n).padStart(2, "0")}`;
const t = dictionary.sales;

beforeEach(() => {
  toggles.forced = undefined;
});

describe("owner (readScope all) — compact dashboard", () => {
  it("operational details are closed by default: no operational rows rendered", async () => {
    const html = await render("all");
    expect(html).toContain(t.workspace.operationalDetails.title);
    expect(html).toMatch(new RegExp(`aria-expanded="false"[^>]*>${t.workspace.operationalDetails.show}`));
    expect(html).not.toContain(attentionName(1));
    expect(html).not.toContain("Reserved Product");
    expect(html).not.toContain("Alpha Fine");
    expect(html).not.toContain("SO-ACTIVE-1");
  });

  it("after opening (and 'show all'): 'hide details', every loaded row, 'collapse'", async () => {
    toggles.forced = true;
    const html = await render("all");
    expect(html).toMatch(new RegExp(`aria-expanded="true"[^>]*>${t.workspace.operationalDetails.hide}`));
    for (let n = 1; n <= 13; n += 1) expect(html).toContain(attentionName(n));
    for (const r of data.reservations) expect(html).toContain(r.productName);
    expect(html).toContain(t.workspace.preview.collapse);
  });

  it("attention preview: first 5 (most critical first), then 'show all (13)'", async () => {
    const { NeedsAttentionCard } = await import("@/components/sales/needs-attention-card");
    const html = renderToStaticMarkup(
      NeedsAttentionCard({ customers: data.attention as never, dictionary, previewLimit: 5 }),
    );
    for (let n = 1; n <= 5; n += 1) expect(html).toContain(attentionName(n));
    expect(html).not.toContain(attentionName(6));
    expect(html).toContain(t.workspace.preview.showAll.replace("{count}", "13"));
  });

  it("reservations: counters from the loaded rows, max 5 problem rows first, 'show all (9)'", async () => {
    const { ReservationsCard } = await import("@/components/sales/reservations-card");
    const html = renderToStaticMarkup(
      ReservationsCard({ reservations: data.reservations as never, locale: "en", dictionary, compact: true }),
    );
    expect(html).toContain(`${t.reservationsCard.counters.expired}: 2`);
    expect(html).toContain(`${t.reservationsCard.counters.expiringSoon}: 4`);
    expect(html).toContain(`${t.reservationsCard.counters.active}: 3`);
    for (const id of ["E1", "E2", "S1", "S2", "S3"]) expect(html).toContain(`Reserved Product ${id}`);
    for (const id of ["S4", "A1", "A2", "A3"]) expect(html).not.toContain(`Reserved Product ${id}`);
    expect(html).toContain(t.workspace.preview.showAll.replace("{count}", "9"));
  });

  it("reservations: no problem rows → a short message, full list still one click away", async () => {
    const { ReservationsCard } = await import("@/components/sales/reservations-card");
    const onlyActive = data.reservations.filter((r) => r.attentionState === "ACTIVE");
    const html = renderToStaticMarkup(
      ReservationsCard({ reservations: onlyActive as never, locale: "en", dictionary, compact: true }),
    );
    expect(html).toContain(t.reservationsCard.noProblems);
    expect(html).not.toContain("Reserved Product");
    expect(html).toContain(t.workspace.preview.showAll.replace("{count}", "3"));
  });

  it("active orders: link keeps ?status=active, header shows the full count (44)", async () => {
    toggles.forced = true;
    const html = await render("all");
    expect(html).toContain('href="/sales/orders?status=active"');
    const card = html.slice(html.indexOf(t.workspace.kpi.activeOrders, html.indexOf(t.workspace.operationalDetails.title)));
    expect(card).toMatch(/>44</);
  });

  it("stock: problem rows first (negative, then inconsistent), then by name; warehouse link", async () => {
    toggles.forced = true;
    const html = await render("all");
    const order = ["Bravo Negative", "Charlie Inconsistent", "Alpha Fine"].map((name) => html.indexOf(name));
    expect(order.every((i) => i > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).toContain('href="/warehouse"');
    expect(html).toContain(t.workspace.goToWarehouse);
  });

  it("receivables: aggregated per currency, finance link", async () => {
    toggles.forced = true;
    const html = await render("all");
    expect(html).toContain('href="/finance"');
    expect(html).toContain(t.workspace.goToFinance);
  });

  it("warehouse / finance links only with the matching permission", async () => {
    toggles.forced = true;
    const html = await render("all", ALL_READ);
    expect(html).not.toContain('href="/warehouse"');
    expect(html).not.toContain('href="/finance"');
  });

  it("company summary: exactly Customers, Turnover, Receivables, Overdue", async () => {
    const html = await render("all");
    const start = html.indexOf(t.workspace.team.companyTotal);
    const block = html.slice(start, html.indexOf("/sales/customers?manager=", start));
    for (const label of ["customers", "turnover", "receivables", "overdue"] as const) {
      expect(block).toContain(t.workspace.team.metrics[label]);
    }
    expect(block).not.toContain(t.workspace.team.metrics.activeOrders);
    expect(block).not.toContain(t.workspace.team.metrics.attention);
  });

  it("manager money: one line per currency, never joined with ' · ' nor truncated", async () => {
    const html = await render("all");
    const start = html.indexOf("/sales/customers?manager=m1");
    const card = html.slice(start, html.indexOf("/sales/customers?manager=m2"));
    expect(card).toContain("<span>140,007.67 EUR</span><span>27,028,000 UAH</span>");
    expect(card).not.toContain(" · ");
    const turnoverDd = card.slice(card.indexOf(t.workspace.team.metrics.turnover)).match(/<dd class="([^"]*)"/)![1];
    expect(turnoverDd).not.toContain("truncate");
  });

  it("overdue KPI: real amounts, one line per currency (not a currency count)", async () => {
    const html = await render("all");
    const kpi = html.slice(html.indexOf(t.workspace.kpi.overdueAr), html.indexOf(t.workspace.kpi.reserved));
    expect(kpi).toContain("6,002.28 EUR");
    expect(kpi).toContain("2,576,133.52 UAH");
    expect(kpi).not.toContain("currencies");
  });
});

describe("manager (readScope own) — full workspace unchanged", () => {
  it("no disclosure, no team block: every operational row is rendered right away", async () => {
    const html = await render("own");
    expect(html).not.toContain(t.workspace.operationalDetails.title);
    expect(html).not.toContain(t.workspace.team.companyTotal);
    for (let n = 1; n <= 13; n += 1) expect(html).toContain(attentionName(n));
    for (const r of data.reservations) expect(html).toContain(r.productName);
    expect(html).not.toContain(`${t.reservationsCard.counters.expired}: `);
    expect(html).not.toContain(`${t.reservationsCard.counters.active}: `);
    expect(html).not.toContain(t.workspace.preview.collapse);
  });

  it("links and ordering as before: /sales/orders, no warehouse/finance links, stock by name", async () => {
    const html = await render("own");
    expect(html).toContain('href="/sales/orders"');
    expect(html).not.toContain("?status=active");
    expect(html).not.toContain('href="/warehouse"');
    expect(html).not.toContain('href="/finance"');
    const order = ["Alpha Fine", "Bravo Negative", "Charlie Inconsistent"].map((name) => html.indexOf(name));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});
