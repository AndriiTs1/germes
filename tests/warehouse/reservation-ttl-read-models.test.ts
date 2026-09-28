import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/lib/generated/prisma/client";

type Reservation = {
  id: string;
  salesOrderItemId: string;
  productId: string;
  quantityKg: Prisma.Decimal;
  status: string;
  expiresAt: Date | null;
  product: { id: string; name: string };
  batch: { id: string; batchNumber: string } | null;
  warehouse: { id: string; code: string; name: string } | null;
};

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  responsibleId: string;
  orderDate: Date;
  requestedDate: Date | null;
  shippedAt: Date | null;
  notes: string | null;
  customer: { id: string; code: string; name: string };
  responsible: { id: string; name: string | null };
  items: { id: string; quantityKg: Prisma.Decimal; product: { id: string; sku: string; name: string } }[];
  reservations: Reservation[];
};

const db = vi.hoisted(() => ({ orders: [] as Order[] }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    salesOrder: {
      // listWarehouseOrders: status IN + nested items.reservations where { status }
      findMany: async ({
        where,
        select,
      }: {
        where: { status: { in: string[] } };
        select: { items: { select: { reservations: { where: { status: string } } } } };
      }) => {
        const reservationStatus = select.items.select.reservations.where.status;
        return db.orders
          .filter((order) => where.status.in.includes(order.status))
          .map((order) => ({
            ...order,
            items: order.items.map((item) => ({
              ...item,
              reservations: order.reservations.filter(
                (r) => r.salesOrderItemId === item.id && r.status === reservationStatus,
              ),
            })),
          }));
      },
      // getWarehouseOrderDetail: id + status IN
      findFirst: async ({ where }: { where: { id: string; status: { in: string[] } } }) =>
        db.orders.find((order) => order.id === where.id && where.status.in.includes(order.status)) ?? null,
    },
    stockReservation: {
      // getReservationsRequiringAttention: status + salesOrder.responsibleId
      findMany: async ({
        where,
      }: {
        where: { status: string; salesOrder: { responsibleId?: string } };
      }) =>
        db.orders
          .filter((order) => !where.salesOrder.responsibleId || order.responsibleId === where.salesOrder.responsibleId)
          .flatMap((order) =>
            order.reservations
              .filter((r) => r.status === where.status)
              .map((r) => ({
                ...r,
                salesOrder: { id: order.id, orderNumber: order.orderNumber, status: order.status, customer: order.customer },
              })),
          ),
    },
  },
}));

import { WarehouseOrderReservations } from "@/components/warehouse/warehouse-order-reservations";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getReservationsRequiringAttention } from "@/lib/services/sales/get-reservations-requiring-attention";
import { isReservationTtlElapsed } from "@/lib/services/sales/reservation-ttl";
import { getWarehouseOrderDetail } from "@/lib/services/warehouse/get-warehouse-order-detail";
import { listWarehouseOrders } from "@/lib/services/warehouse/list-warehouse-orders";

const NOW = new Date("2026-09-28T12:00:00.000Z");
const PAST = new Date("2026-09-25T12:00:00.000Z"); // 24h TTL long gone
const FUTURE = new Date("2026-09-28T20:00:00.000Z"); // within the "expiring soon" window
const d = (value: string) => new Prisma.Decimal(value);

/** One order, one 100 kg item, fully covered by one reservation. */
function order(status: string, expiresAt: Date | null, reservationStatus = "ACTIVE"): Order {
  const id = `order-${status}-${reservationStatus}-${expiresAt?.getTime() ?? "none"}`;
  return {
    id,
    orderNumber: `SO-${status}`,
    status,
    responsibleId: "sales-1",
    orderDate: new Date("2026-09-20T09:00:00.000Z"),
    requestedDate: null,
    shippedAt: null,
    notes: null,
    customer: { id: "c1", code: "CUST-001", name: "Customer" },
    responsible: { id: "sales-1", name: "Seller" },
    items: [{ id: `${id}-item`, quantityKg: d("100"), product: { id: "p1", sku: "SKU-1", name: "Product" } }],
    reservations: [
      {
        id: `${id}-res`,
        salesOrderItemId: `${id}-item`,
        productId: "p1",
        quantityKg: d("100"),
        status: reservationStatus,
        expiresAt,
        product: { id: "p1", name: "Product" },
        batch: { id: "b1", batchNumber: "B-1" },
        warehouse: { id: "w1", code: "WH-KYIV", name: "Kyiv" },
      },
    ],
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  db.orders = [];
});
afterEach(() => {
  vi.useRealTimers();
});

const CASES = [
  ["1", "CONFIRMED", FUTURE, true],
  ["2", "CONFIRMED", PAST, false],
  ["3", "PROCESSING", FUTURE, true],
  ["4", "PROCESSING", PAST, true],
  ["5", "READY", FUTURE, true],
  ["6", "READY", PAST, true],
] as const;

describe("reservation TTL rule (read side)", () => {
  it.each(CASES)("%s. %s, expiresAt %s → counts: %s", (_n, status, expiresAt, counts) => {
    expect(isReservationTtlElapsed(status, expiresAt, NOW)).toBe(!counts);
  });

  it("expiresAt exactly now is elapsed for CONFIRMED (same <= as startSalesOrderProcessing); null never elapses", () => {
    expect(isReservationTtlElapsed("CONFIRMED", NOW, NOW)).toBe(true);
    expect(isReservationTtlElapsed("CONFIRMED", null, NOW)).toBe(false);
  });
});

describe("listWarehouseOrders — reserved quantity per order status", () => {
  it.each(CASES)("%s. %s, expiresAt %s → fully reserved: %s", async (_n, status, expiresAt, counts) => {
    db.orders = [order(status, expiresAt)];
    const [queued] = await listWarehouseOrders();
    expect(queued.isFullyReserved).toBe(counts);
    expect(queued.reservedQuantityKg).toBe(counts ? "100" : "0");
    expect(queued.activeReservationCount).toBe(counts ? 1 : 0);
  });

  it.each(["RELEASED", "EXPIRED", "CONSUMED"])("7. a %s reservation never counts, for any status", async (reservationStatus) => {
    db.orders = ["CONFIRMED", "PROCESSING", "READY"].map((status) => order(status, FUTURE, reservationStatus));
    for (const queued of await listWarehouseOrders()) {
      expect(queued.isFullyReserved).toBe(false);
      expect(queued.reservedQuantityKg).toBe("0");
    }
  });

  it("8. historical PROCESSING/READY orders (reserved days ago) show fully reserved; the CONFIRMED one does not", async () => {
    db.orders = [order("READY", PAST), order("PROCESSING", PAST), order("CONFIRMED", PAST)];
    const byStatus = Object.fromEntries((await listWarehouseOrders()).map((q) => [q.status, q.isFullyReserved]));
    expect(byStatus).toEqual({ READY: true, PROCESSING: true, CONFIRMED: false });
  });
});

describe("getWarehouseOrderDetail — usable reservations per order status", () => {
  it.each(CASES)("%s. %s, expiresAt %s → item fully reserved: %s", async (_n, status, expiresAt, counts) => {
    const o = order(status, expiresAt);
    db.orders = [o];
    const detail = (await getWarehouseOrderDetail(o.id))!;
    expect(detail.items[0].isFullyReserved).toBe(counts);
    expect(detail.items[0].usableReservedQuantityKg).toBe(counts ? "100" : "0");
    expect(detail.isFullyReserved).toBe(counts);
    expect(detail.reservations[0].isTtlElapsed).toBe(!counts);
  });

  it.each(["RELEASED", "EXPIRED", "CONSUMED"])("7. a %s reservation is listed but never usable nor flagged elapsed", async (reservationStatus) => {
    const o = order("PROCESSING", PAST, reservationStatus);
    db.orders = [o];
    const detail = (await getWarehouseOrderDetail(o.id))!;
    expect(detail.items[0].isFullyReserved).toBe(false);
    expect(detail.reservations).toHaveLength(1);
    expect(detail.reservations[0].isTtlElapsed).toBe(false);
  });

  it("9. PROCESSING/READY items show no false 'not fully reserved' and no elapsed note; CONFIRMED still does", async () => {
    const dictionary = getDictionary("en");
    const t = dictionary.warehouse.orderDetail.reservations;
    for (const [status, expectNote] of [["PROCESSING", false], ["READY", false], ["CONFIRMED", true]] as const) {
      const o = order(status, PAST);
      db.orders = [o];
      const detail = (await getWarehouseOrderDetail(o.id))!;
      const html = renderToStaticMarkup(
        WarehouseOrderReservations({ reservations: detail.reservations, locale: "en", dictionary }),
      );
      expect(html.includes(t.elapsedNote)).toBe(expectNote);
    }
  });
});

describe("getReservationsRequiringAttention — TTL states only while the TTL applies", () => {
  const stateOf = async () => (await getReservationsRequiringAttention("sales-1"))[0].attentionState;

  it.each(["PROCESSING", "READY"])("10. %s with a past expiresAt is not EXPIRED_ACTIVE", async (status) => {
    db.orders = [order(status, PAST)];
    expect(await stateOf()).toBe("ACTIVE");
  });

  it.each(["PROCESSING", "READY"])("%s expiring within hours is not EXPIRING_SOON either", async (status) => {
    db.orders = [order(status, FUTURE)];
    expect(await stateOf()).toBe("ACTIVE");
  });

  it("11. CONFIRMED with a past expiresAt is still EXPIRED_ACTIVE", async () => {
    db.orders = [order("CONFIRMED", PAST)];
    expect(await stateOf()).toBe("EXPIRED_ACTIVE");
  });

  it("CONFIRMED expiring within hours is still EXPIRING_SOON", async () => {
    db.orders = [order("CONFIRMED", FUTURE)];
    expect(await stateOf()).toBe("EXPIRING_SOON");
  });

  it("CONFIRMED expired items still sort first, ahead of PROCESSING/READY rows", async () => {
    db.orders = [order("READY", PAST), order("CONFIRMED", PAST), order("PROCESSING", PAST)];
    const items = await getReservationsRequiringAttention("sales-1");
    expect(items.map((item) => item.attentionState)).toEqual(["EXPIRED_ACTIVE", "ACTIVE", "ACTIVE"]);
    expect(items[0].orderNumber).toBe("SO-CONFIRMED");
  });
});
