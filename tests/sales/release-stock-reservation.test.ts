import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/lib/generated/prisma/client";

type Order = { id: string; responsibleId: string; status: string };
type Reservation = {
  id: string;
  salesOrderId: string | null;
  salesOrderItemId: string | null;
  productId: string;
  batchId: string | null;
  warehouseId: string | null;
  quantityKg: Prisma.Decimal;
  status: string;
};

type ReservationWhere = {
  id?: string;
  status?: string;
  salesOrderId?: string;
  salesOrder?: { responsibleId?: string; status?: string };
};

const state = vi.hoisted(() => ({
  orders: [] as Order[],
  reservations: [] as Reservation[],
  audit: [] as unknown[],
  /** Runs between the service's read and its guarded update (simulates a concurrent change). */
  beforeUpdate: undefined as undefined | (() => void),
}));

/** Evaluates exactly the where shapes releaseStockReservation uses. */
function matches(reservation: Reservation, where: ReservationWhere): boolean {
  if (where.id !== undefined && reservation.id !== where.id) return false;
  if (where.status !== undefined && reservation.status !== where.status) return false;
  if (where.salesOrderId !== undefined && reservation.salesOrderId !== where.salesOrderId) return false;
  if (where.salesOrder) {
    const order = state.orders.find((candidate) => candidate.id === reservation.salesOrderId);
    if (!order) return false;
    if (where.salesOrder.responsibleId !== undefined && order.responsibleId !== where.salesOrder.responsibleId) {
      return false;
    }
    if (where.salesOrder.status !== undefined && order.status !== where.salesOrder.status) return false;
  }
  return true;
}

vi.mock("@/lib/db/prisma", () => {
  const tx = {
    stockReservation: {
      findFirst: async ({ where }: { where: ReservationWhere }) =>
        state.reservations.find((reservation) => matches(reservation, where)) ?? null,
      updateMany: async ({ where, data }: { where: ReservationWhere; data: { status: string } }) => {
        state.beforeUpdate?.();
        const targets = state.reservations.filter((reservation) => matches(reservation, where));
        for (const reservation of targets) reservation.status = data.status;
        return { count: targets.length };
      },
    },
    auditLog: {
      create: async ({ data }: { data: unknown }) => {
        state.audit.push(data);
        return data;
      },
    },
  };
  return {
    prisma: {
      // Mirrors rollback: on any throw, restore the snapshot taken at the start.
      $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => {
        const snapshot = state.reservations.map((reservation) => ({ ...reservation }));
        const auditLength = state.audit.length;
        try {
          return await callback(tx);
        } catch (error) {
          state.reservations = snapshot;
          state.audit.length = auditLength;
          throw error;
        }
      },
    },
  };
});

import { releaseStockReservation } from "@/lib/services/sales/release-stock-reservation";

const SELLER = "seller-1";
const OTHER_SELLER = "seller-2";

function setup(orderStatus: string, reservationStatus = "ACTIVE", responsibleId = SELLER) {
  state.orders = [{ id: "order-1", responsibleId, status: orderStatus }];
  state.reservations = [
    {
      id: "res-1",
      salesOrderId: "order-1",
      salesOrderItemId: "item-1",
      productId: "product-1",
      batchId: "batch-1",
      warehouseId: "wh-1",
      quantityKg: new Prisma.Decimal("100"),
      status: reservationStatus,
    },
  ];
  state.audit = [];
  state.beforeUpdate = undefined;
}

function reservationStatus() {
  return state.reservations[0].status;
}

beforeEach(() => setup("CONFIRMED"));

describe("releaseStockReservation — order status", () => {
  it("1. CONFIRMED + ACTIVE → released, with an audit entry", async () => {
    expect(await releaseStockReservation(SELLER, "res-1")).toEqual({
      ok: true,
      reservationId: "res-1",
      salesOrderId: "order-1",
    });
    expect(reservationStatus()).toBe("RELEASED");
    expect(state.audit).toHaveLength(1);
  });

  it.each(["PROCESSING", "READY", "SHIPPED", "CANCELLED", "DRAFT"])(
    "2–4. %s → refused; reservation stays ACTIVE, no audit",
    async (status) => {
      setup(status);
      expect(await releaseStockReservation(SELLER, "res-1")).toEqual({
        ok: false,
        error: "RESERVATION_UNAVAILABLE",
      });
      expect(reservationStatus()).toBe("ACTIVE");
      expect(state.audit).toHaveLength(0);
    },
  );

  it("7. order moves to PROCESSING between the read and the update → refused, nothing changes", async () => {
    state.beforeUpdate = () => {
      state.orders[0].status = "PROCESSING";
    };
    expect(await releaseStockReservation(SELLER, "res-1")).toEqual({
      ok: false,
      error: "RESERVATION_UNAVAILABLE",
    });
    expect(reservationStatus()).toBe("ACTIVE");
    expect(state.audit).toHaveLength(0);
  });
});

describe("releaseStockReservation — existing rules unchanged", () => {
  it("5. another seller's order → refused", async () => {
    setup("CONFIRMED", "ACTIVE", OTHER_SELLER);
    expect(await releaseStockReservation(SELLER, "res-1")).toEqual({
      ok: false,
      error: "RESERVATION_UNAVAILABLE",
    });
    expect(reservationStatus()).toBe("ACTIVE");
    expect(state.audit).toHaveLength(0);
  });

  it.each(["RELEASED", "EXPIRED", "CONSUMED"])("6. %s reservation → refused, unchanged", async (status) => {
    setup("CONFIRMED", status);
    expect(await releaseStockReservation(SELLER, "res-1")).toEqual({
      ok: false,
      error: "RESERVATION_UNAVAILABLE",
    });
    expect(reservationStatus()).toBe(status);
    expect(state.audit).toHaveLength(0);
  });
});
