import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/lib/generated/prisma/client";

type Movement = { type: string; quantityKg: Prisma.Decimal };
type Reservation = { status: string; quantityKg: Prisma.Decimal };
type Order = {
  id: string;
  orderNumber: string;
  status: string;
  orderDate: Date;
  currency: string;
  customer: { name: string };
  items: { quantityKg: Prisma.Decimal; pricePerKg: Prisma.Decimal }[];
};

const db = vi.hoisted(() => ({
  movements: [] as Movement[],
  reservations: [] as Reservation[],
  orders: [] as Order[],
}));

type OrderQuery = {
  where?: { status?: string | { in?: string[] } };
  orderBy?: Record<string, "asc" | "desc">[];
  take?: number;
};

function statusMatches(status: string, filter: OrderQuery["where"]) {
  const s = filter?.status;
  if (s === undefined) return true;
  return typeof s === "string" ? status === s : !s.in || s.in.includes(status);
}

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    stockMovement: { findMany: async () => db.movements },
    stockReservation: {
      findMany: async ({ where }: { where?: { status?: string } } = {}) =>
        db.reservations.filter((r) => !where?.status || r.status === where.status),
    },
    salesOrder: {
      // getRecentOrders: orderBy [{orderDate}, {id}] + take
      findMany: async ({ orderBy = [], take }: OrderQuery = {}) => {
        const sorted = [...db.orders].sort((a, b) => {
          for (const clause of orderBy) {
            const [key, dir] = Object.entries(clause)[0] as ["orderDate" | "id", "asc" | "desc"];
            const av = key === "orderDate" ? a.orderDate.getTime() : a.id;
            const bv = key === "orderDate" ? b.orderDate.getTime() : b.id;
            if (av !== bv) return (av < bv ? -1 : 1) * (dir === "asc" ? 1 : -1);
          }
          return 0;
        });
        return take === undefined ? sorted : sorted.slice(0, take);
      },
      count: async ({ where }: OrderQuery = {}) => db.orders.filter((o) => statusMatches(o.status, where)).length,
    },
    receivable: { findMany: async () => [] },
    payable: { findMany: async () => [] },
  },
}));

import { InventoryStatus } from "@/components/dashboard/analytics/inventory-status";
import { NeedsAttention } from "@/components/dashboard/operations/needs-attention";
import { RecentOrders } from "@/components/dashboard/operations/recent-orders";
import { formatKg, formatMoney } from "@/components/sales/format";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getAttentionItems } from "@/lib/services/dashboard/get-attention-items";
import { getInventoryStatus } from "@/lib/services/dashboard/get-inventory-status";
import { getRecentOrders } from "@/lib/services/dashboard/get-recent-orders";

const d = (value: string) => new Prisma.Decimal(value);
const mv = (type: string, kg: string): Movement => ({ type, quantityKg: d(kg) });
const res = (status: string, kg: string): Reservation => ({ status, quantityKg: d(kg) });

beforeEach(() => {
  db.movements = [];
  db.reservations = [];
  db.orders = [];
});

describe("Inventory Status — only real segments", () => {
  it("29. physical stock formula unchanged (RECEIPT/TRANSFER +, SHIPMENT/WRITE_OFF −, ADJUSTMENT ignored)", async () => {
    db.movements = [mv("RECEIPT", "1000"), mv("TRANSFER", "50"), mv("SHIPMENT", "200"), mv("WRITE_OFF", "30"), mv("ADJUSTMENT", "999")];
    expect((await getInventoryStatus()).value).toBe("820");
  });

  it("30. reserved uses ACTIVE reservations only", async () => {
    db.movements = [mv("RECEIPT", "1000")];
    db.reservations = [res("ACTIVE", "250"), res("RELEASED", "300"), res("EXPIRED", "100"), res("CONSUMED", "400")];
    const { segments } = await getInventoryStatus();
    expect(segments).toEqual([
      { key: "available", pct: 75, accent: "mint" },
      { key: "reserved", pct: 25, accent: "blue" },
    ]);
  });

  it("31 + 32. available = physical − reserved; the two always sum to 100%", async () => {
    // 1/3 reserved: rounding both halves separately could give 67 + 33 or 66 + 33; never here.
    for (const [physical, reserved] of [["3", "1"], ["1000", "505"], ["7", "3.5"], ["200", "1"]]) {
      db.movements = [mv("RECEIPT", physical)];
      db.reservations = [res("ACTIVE", reserved)];
      const [available, reservedSeg] = (await getInventoryStatus()).segments;
      expect(available.pct + reservedSeg.pct).toBe(100);
    }
  });

  it.each([
    ["ru", "Доступно", "Зарезервировано", ["В пути", "Низкий остаток", "В наличии"]],
    ["uk", "Доступно", "Зарезервовано", ["В дорозі", "Малий залишок", "В наявності"]],
    ["en", "Available", "Reserved", ["In transit", "Low stock", "In stock"]],
  ] as const)("33–35. %s: Available + Reserved only; no in-transit / low-stock", async (locale, availableLabel, reservedLabel, gone) => {
    db.movements = [mv("RECEIPT", "12500")];
    db.reservations = [res("ACTIVE", "2500")];
    const html = renderToStaticMarkup(await InventoryStatus({ locale, dictionary: getDictionary(locale) }));
    expect(html).toContain(availableLabel);
    expect(html).toContain(reservedLabel);
    for (const label of gone) expect(html).not.toContain(label);
    expect(html).toContain(formatKg("12500", locale)); // physical total, locale-formatted
    expect(html).toContain("80%");
    expect(html).toContain("20%");
  });

  it("36. empty stock → safe zero state (0 kg, 0% / 0%, no NaN)", async () => {
    const { value, segments } = await getInventoryStatus();
    expect(value).toBe("0");
    expect(segments.map((s) => s.pct)).toEqual([0, 0]);
    const html = renderToStaticMarkup(await InventoryStatus({ locale: "en", dictionary: getDictionary("en") }));
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });
});

describe("Recent Orders — Kyiv time, real currency, real status", () => {
  const NOW = new Date("2026-09-28T12:00:00.000Z");
  let seq = 0;
  function order(status: string, orderDate: string, amount = "1000", currency = "UAH", id?: string): Order {
    seq += 1;
    return {
      id: id ?? `id-${String(seq).padStart(3, "0")}`,
      orderNumber: `SO-2026-${String(seq).padStart(3, "0")}`,
      status,
      orderDate: new Date(orderDate),
      currency,
      customer: { name: `Customer ${seq}` },
      items: [{ quantityKg: d("1"), pricePerKg: d(amount) }],
    };
  }
  async function render(locale: "en" | "ru" | "uk" = "en") {
    const dictionary = getDictionary(locale);
    return { html: renderToStaticMarkup(await RecentOrders({ locale, dictionary })), dictionary };
  }

  beforeEach(() => {
    seq = 0;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("37. Europe/Kyiv at the UTC day boundary: 27 Sep 21:30 UTC is 28 Sep 00:30 in Kyiv → 'Today, 00:30'", async () => {
    db.orders = [order("CONFIRMED", "2026-09-27T21:30:00.000Z")];
    const { html, dictionary } = await render("en");
    expect(html).toContain(`${dictionary.commandCenter.recentOrders.todayPrefix} 00:30`);
    expect(html).not.toContain("21:30");
  });

  it("an earlier Kyiv day shows day + month + Kyiv time; another year also shows the year", async () => {
    db.orders = [
      order("SHIPPED", "2026-09-10T13:05:00.000Z"),
      order("SHIPPED", "2025-12-31T22:30:00.000Z"),
      order("SHIPPED", "2025-11-10T10:00:00.000Z"),
    ];
    const { html } = await render("en");
    expect(html).toContain("Sep 10, 16:05"); // 13:05 UTC = 16:05 EEST
    expect(html).toContain("Jan 1, 00:30"); // 22:30 UTC 31 Dec = 00:30 EET 1 Jan 2026 — the current Kyiv year, so no year
    expect(html).toContain("Nov 10, 2025, 12:00"); // previous year → year shown
  });

  it("38 + 39. amount is locale-formatted in the order's own currency", async () => {
    db.orders = [order("SHIPPED", "2026-09-20T10:00:00.000Z", "1234567.5", "EUR"), order("SHIPPED", "2026-09-19T10:00:00.000Z", "98000", "UAH")];
    const { html } = await render("uk");
    expect(html).toContain(formatMoney("1234567.5", "EUR", "uk"));
    expect(html).toContain(formatMoney("98000", "UAH", "uk"));
    expect(html).not.toContain("1234567.5 EUR");
  });

  it.each(["DRAFT", "CONFIRMED", "PROCESSING", "READY", "SHIPPED", "COMPLETED", "CANCELLED"])(
    "40–43. %s is shown with its own localized status",
    async (status) => {
      db.orders = [order(status, "2026-09-20T10:00:00.000Z")];
      for (const locale of ["en", "ru", "uk"] as const) {
        const { html, dictionary } = await render(locale);
        expect(html).toContain((dictionary.status.order as Record<string, string>)[status]);
      }
    },
  );

  it("statuses are visually distinct (own colour classes)", async () => {
    db.orders = [order("DRAFT", "2026-09-20T10:00:00.000Z"), order("CANCELLED", "2026-09-19T10:00:00.000Z"), order("SHIPPED", "2026-09-18T10:00:00.000Z")];
    const { html } = await render("en");
    expect(html).toContain("bg-slate-100 text-slate-600");
    expect(html).toContain("bg-rose-50 text-rose-600");
    expect(html).toContain("bg-teal-50 text-teal-600");
  });

  it("44. equal orderDate → id DESC tie-breaker, newest first, limit 5", async () => {
    const same = "2026-09-20T10:00:00.000Z";
    db.orders = [
      order("SHIPPED", same, "1", "UAH", "id-a"),
      order("SHIPPED", same, "1", "UAH", "id-c"),
      order("SHIPPED", same, "1", "UAH", "id-b"),
      order("SHIPPED", "2026-09-21T10:00:00.000Z", "1", "UAH", "id-z"),
      order("SHIPPED", "2026-09-01T10:00:00.000Z", "1", "UAH", "id-y"),
      order("SHIPPED", "2026-08-01T10:00:00.000Z", "1", "UAH", "id-x"),
    ];
    expect((await getRecentOrders()).map((o) => o.id)).toEqual(["id-z", "id-c", "id-b", "id-a", "id-y"]);
  });

  it.each(["en", "ru", "uk"] as const)("45. %s: no orders → empty-state text, no rows", async (locale) => {
    const { html, dictionary } = await render(locale);
    expect(html).toContain(dictionary.commandCenter.recentOrders.empty);
    expect(html).not.toContain("<li");
    expect(html).not.toContain("undefined");
  });
});

describe("Needs Attention — confirmed-orders item says what it counts", () => {
  const orderOf = (status: string): Order => ({
    id: status,
    orderNumber: status,
    status,
    orderDate: new Date(),
    currency: "UAH",
    customer: { name: "c" },
    items: [],
  });

  it("46. formula unchanged: only CONFIRMED is counted", async () => {
    db.orders = ["CONFIRMED", "CONFIRMED", "PROCESSING", "READY", "DRAFT"].map(orderOf);
    expect(await getAttentionItems()).toEqual([{ kind: "confirmedOrdersAwaitingProcessing", count: 2 }]);
  });

  it.each([
    ["ru", "Подтверждённые заказы ожидают обработки", /отгруз/i],
    ["uk", "Підтверджені замовлення очікують обробки", /відвантаж/i],
    ["en", "Confirmed orders awaiting processing", /shipment/i],
  ] as const)("47. %s: honest label, no 'awaiting shipment'", async (locale, label, shipment) => {
    db.orders = [orderOf("CONFIRMED")];
    const html = renderToStaticMarkup(await NeedsAttention({ locale, dictionary: getDictionary(locale) }));
    expect(html).toContain(label);
    expect(html).not.toMatch(shipment);
  });
});
