import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  baseState,
  createFakePrisma,
  makeOrder,
  PRODUCT_A,
  PRODUCT_B,
  SUPPLIER_ID,
  WAREHOUSE_ID,
  type FakeState,
} from "./fake-prisma";

const h = vi.hoisted(() => ({ prisma: {} as Record<string, unknown> }));
vi.mock("@/lib/db/prisma", () => ({ prisma: h.prisma }));

import { createPurchaseOrder } from "@/lib/services/procurement/create-purchase-order";
import { transitionPurchaseOrderStatus } from "@/lib/services/procurement/transition-purchase-order-status";
import { updatePurchaseOrder } from "@/lib/services/procurement/update-purchase-order";
import { createPurchaseOrderSchema, type CreatePurchaseOrderInput } from "@/lib/validation/purchase-order";

let state: FakeState;

function useState(next: FakeState) {
  state = next;
  for (const key of Object.keys(h.prisma)) delete h.prisma[key];
  Object.assign(h.prisma, createFakePrisma(state));
}

const LOADED_AT = "2026-09-27T09:00:00.000Z";

const validInput = (overrides: Partial<CreatePurchaseOrderInput> = {}): CreatePurchaseOrderInput => ({
  supplierId: SUPPLIER_ID,
  destinationWarehouseId: WAREHOUSE_ID,
  currency: "EUR",
  expectedArrivalDate: "2026-10-01",
  notes: "updated",
  items: [
    { productId: PRODUCT_A, quantityKg: "500", pricePerKg: "150" },
    { productId: PRODUCT_B, quantityKg: "20.5", pricePerKg: undefined },
  ],
  ...overrides,
});

beforeEach(() => {
  useState(baseState());
});

describe("updatePurchaseOrder (edit DRAFT)", () => {
  it("1. updates a DRAFT: fields and items replaced, protected fields untouched, audited", async () => {
    state.orders.push(makeOrder());
    const result = await updatePurchaseOrder("user-1", "po-1", LOADED_AT, validInput());

    expect(result).toEqual({ ok: true });
    const order = state.orders[0];
    expect(order.currency).toBe("EUR");
    expect(order.notes).toBe("updated");
    expect(order.expectedArrivalDate?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(order.items.map((i) => [i.productId, i.quantityKg.toString(), i.pricePerKg?.toString() ?? null])).toEqual([
      [PRODUCT_A, "500", "150"],
      [PRODUCT_B, "20.5", null],
    ]);
    expect(order.status).toBe("DRAFT");
    expect(order.orderNumber).toBe("PO-2026-001");
    expect(order.createdById).toBe("creator-1");
    expect(order.orderDate).toBeNull();
    expect(state.audit).toEqual([
      expect.objectContaining({ actorId: "user-1", entityType: "PurchaseOrder", entityId: "po-1", action: "UPDATE" }),
    ]);
  });

  it.each(["CONFIRMED", "CANCELLED", "CLOSED"] as const)("2–4. rejects editing a %s order", async (status) => {
    state.orders.push(makeOrder({ status }));
    const result = await updatePurchaseOrder("user-1", "po-1", LOADED_AT, validInput());

    expect(result).toEqual({ ok: false, error: "ORDER_NOT_EDITABLE" });
    expect(state.orders[0].currency).toBe("UAH");
    expect(state.orders[0].items).toHaveLength(1);
    expect(state.audit).toHaveLength(0);
  });

  it("5. rejects an invalid currency (both schema and service)", async () => {
    state.orders.push(makeOrder());
    expect(createPurchaseOrderSchema.safeParse({ ...validInput(), currency: "USD" }).success).toBe(false);

    const bypassingZod = { ...validInput(), currency: "USD" } as unknown as CreatePurchaseOrderInput;
    const result = await updatePurchaseOrder("user-1", "po-1", LOADED_AT, bypassingZod);
    expect(result).toEqual({ ok: false, error: "UPDATE_FAILED" });
    expect(state.orders[0].currency).toBe("UAH");
  });

  it("rejects a stale edit (order changed since the form was loaded)", async () => {
    state.orders.push(makeOrder({ updatedAt: new Date("2026-09-27T09:30:00.000Z") }));
    const result = await updatePurchaseOrder("user-1", "po-1", LOADED_AT, validInput());
    expect(result).toEqual({ ok: false, error: "STALE_EDIT" });
    expect(state.orders[0].items).toHaveLength(1);
  });

  it("race: status changes between read and write → rejected, items untouched", async () => {
    state.orders.push(makeOrder());
    state.beforeWrite = () => {
      state.orders[0].status = "CONFIRMED";
    };
    const result = await updatePurchaseOrder("user-1", "po-1", LOADED_AT, validInput());
    expect(result).toEqual({ ok: false, error: "ORDER_NOT_EDITABLE" });
    expect(state.orders[0].items).toHaveLength(1);
    expect(state.orders[0].currency).toBe("UAH");
    expect(state.audit).toHaveLength(0);
  });

  it("race: a concurrent edit between read and write → STALE_EDIT, items and audit untouched", async () => {
    state.orders.push(makeOrder());
    state.beforeWrite = () => {
      state.orders[0].updatedAt = new Date("2026-09-27T09:45:00.000Z");
    };
    const result = await updatePurchaseOrder("user-1", "po-1", LOADED_AT, validInput());
    expect(result).toEqual({ ok: false, error: "STALE_EDIT" });
    expect(state.orders[0].items).toHaveLength(1);
    expect(state.audit).toHaveLength(0);
  });

  it.each(["POTENTIAL", "IN_PROGRESS"])("a DRAFT can still be edited with a %s supplier", async (status) => {
    state.orders.push(makeOrder());
    state.suppliers[0].status = status;
    expect(await updatePurchaseOrder("user-1", "po-1", LOADED_AT, validInput())).toEqual({ ok: true });
  });

  it("rejects an unavailable supplier / product", async () => {
    state.orders.push(makeOrder());
    state.suppliers[0].status = "BLOCKED";
    expect(await updatePurchaseOrder("user-1", "po-1", LOADED_AT, validInput())).toEqual({
      ok: false,
      error: "SUPPLIER_UNAVAILABLE",
    });
    state.suppliers[0].status = "ACTIVE";
    state.products[1].isActive = false;
    expect(await updatePurchaseOrder("user-1", "po-1", LOADED_AT, validInput())).toEqual({
      ok: false,
      error: "PRODUCT_UNAVAILABLE",
    });
  });
});

describe("transitionPurchaseOrderStatus — CONFIRM", () => {
  it("7–8. DRAFT → CONFIRMED sets orderDate once, audited, serializable", async () => {
    state.orders.push(makeOrder());
    const before = Date.now();
    const result = await transitionPurchaseOrderStatus("user-1", "po-1", "CONFIRM");

    expect(result).toEqual({ ok: true, fromStatus: "DRAFT", toStatus: "CONFIRMED" });
    expect(state.orders[0].status).toBe("CONFIRMED");
    expect(state.orders[0].orderDate).toBeInstanceOf(Date);
    expect(state.orders[0].orderDate!.getTime()).toBeGreaterThanOrEqual(before);
    expect(state.audit).toEqual([
      expect.objectContaining({
        action: "CONFIRM",
        metadata: { orderNumber: "PO-2026-001", fromStatus: "DRAFT", toStatus: "CONFIRMED" },
      }),
    ]);
    expect(state.transactionOptions[0]).toEqual({ isolationLevel: "Serializable" });
  });

  it("9. confirming a CONFIRMED order is rejected and orderDate is not changed", async () => {
    const originalOrderDate = new Date("2026-09-20T08:00:00.000Z");
    state.orders.push(makeOrder({ status: "CONFIRMED", orderDate: originalOrderDate }));
    const result = await transitionPurchaseOrderStatus("user-1", "po-1", "CONFIRM");

    expect(result).toEqual({ ok: false, error: "INVALID_TRANSITION" });
    expect(state.orders[0].orderDate).toEqual(originalOrderDate);
  });

  it.each(["CANCELLED", "CLOSED"] as const)("10–11. %s → CONFIRMED is rejected", async (status) => {
    state.orders.push(makeOrder({ status }));
    expect(await transitionPurchaseOrderStatus("user-1", "po-1", "CONFIRM")).toEqual({
      ok: false,
      error: "INVALID_TRANSITION",
    });
    expect(state.orders[0].status).toBe(status);
  });

  it("12. race: status changes between read and write → no successful transition", async () => {
    state.orders.push(makeOrder());
    state.beforeWrite = () => {
      state.orders[0].status = "CANCELLED";
    };
    const result = await transitionPurchaseOrderStatus("user-1", "po-1", "CONFIRM");

    expect(result).toEqual({ ok: false, error: "STATUS_CHANGED" });
    expect(state.orders[0].status).toBe("CANCELLED");
    expect(state.orders[0].orderDate).toBeNull();
    expect(state.audit).toHaveLength(0);
  });

  it("confirm succeeds only for an ACTIVE supplier with isActive=true", async () => {
    state.orders.push(makeOrder());
    expect((await transitionPurchaseOrderStatus("user-1", "po-1", "CONFIRM")).ok).toBe(true);
  });

  it.each([
    { status: "POTENTIAL", isActive: true },
    { status: "IN_PROGRESS", isActive: true },
    { status: "INACTIVE", isActive: true },
    { status: "BLOCKED", isActive: true },
    { status: "ACTIVE", isActive: false },
  ])("confirm is rejected for supplier $status / isActive=$isActive — no mutation", async ({ status, isActive }) => {
    const order = makeOrder();
    const originalUpdatedAt = order.updatedAt.getTime();
    state.orders.push(order);
    state.suppliers[0] = { ...state.suppliers[0], status, isActive };

    expect(await transitionPurchaseOrderStatus("user-1", "po-1", "CONFIRM")).toEqual({
      ok: false,
      error: "SUPPLIER_NOT_ACTIVE",
    });
    expect(state.orders[0].status).toBe("DRAFT");
    expect(state.orders[0].orderDate).toBeNull();
    expect(state.orders[0].updatedAt.getTime()).toBe(originalUpdatedAt);
    expect(state.audit).toHaveLength(0);
  });

  it("cancel is not blocked by supplier status (only CONFIRM requires ACTIVE)", async () => {
    state.orders.push(makeOrder());
    state.suppliers[0].status = "POTENTIAL";
    expect((await transitionPurchaseOrderStatus("user-1", "po-1", "CANCEL")).ok).toBe(true);
  });

  it("confirming does not require prices or a planned arrival date", async () => {
    state.orders.push(
      makeOrder({ expectedArrivalDate: null, items: [{ productId: PRODUCT_A, quantityKg: { toString: () => "5" }, pricePerKg: null }] }),
    );
    expect((await transitionPurchaseOrderStatus("user-1", "po-1", "CONFIRM")).ok).toBe(true);
  });

  it("unknown order → INVALID_TRANSITION", async () => {
    expect(await transitionPurchaseOrderStatus("user-1", "missing", "CONFIRM")).toEqual({
      ok: false,
      error: "INVALID_TRANSITION",
    });
  });
});

describe("transitionPurchaseOrderStatus — CANCEL", () => {
  it.each(["DRAFT", "CONFIRMED"] as const)("13–14. %s → CANCELLED succeeds and is audited", async (status) => {
    state.orders.push(makeOrder({ status }));
    const result = await transitionPurchaseOrderStatus("user-1", "po-1", "CANCEL");

    expect(result).toEqual({ ok: true, fromStatus: status, toStatus: "CANCELLED" });
    expect(state.orders[0].status).toBe("CANCELLED");
    expect(state.audit).toEqual([
      expect.objectContaining({ action: "CANCEL", metadata: expect.objectContaining({ fromStatus: status }) }),
    ]);
  });

  it("cancel does not set orderDate", async () => {
    state.orders.push(makeOrder());
    await transitionPurchaseOrderStatus("user-1", "po-1", "CANCEL");
    expect(state.orders[0].orderDate).toBeNull();
  });

  it.each(["CANCELLED", "CLOSED"] as const)("15–16. %s → CANCELLED is rejected", async (status) => {
    state.orders.push(makeOrder({ status }));
    expect(await transitionPurchaseOrderStatus("user-1", "po-1", "CANCEL")).toEqual({
      ok: false,
      error: "INVALID_TRANSITION",
    });
    expect(state.orders[0].status).toBe(status);
    expect(state.audit).toHaveLength(0);
  });
});

describe("currency regression (create)", () => {
  const createInput = (currency: string) =>
    ({
      supplierId: SUPPLIER_ID,
      currency,
      items: [{ productId: PRODUCT_A, quantityKg: "1000", pricePerKg: "160" }],
    }) as CreatePurchaseOrderInput;

  it.each(["UAH", "EUR"])("18–19. a %s purchase order is still created as DRAFT", async (currency) => {
    const result = await createPurchaseOrder("user-1", createInput(currency));
    expect(result.ok).toBe(true);
    expect(state.orders[0]).toMatchObject({ currency, status: "DRAFT", orderDate: null, orderNumber: "PO-2026-001" });
    expect(createPurchaseOrderSchema.safeParse({ ...createInput(currency) }).success).toBe(true);
  });

  it.each(["POTENTIAL", "IN_PROGRESS"])("a DRAFT can still be created with a %s supplier", async (status) => {
    state.suppliers[0].status = status;
    expect((await createPurchaseOrder("user-1", createInput("UAH"))).ok).toBe(true);
  });

  it.each(["INACTIVE", "BLOCKED"])("a DRAFT cannot be created with a %s supplier", async (status) => {
    state.suppliers[0].status = status;
    expect(await createPurchaseOrder("user-1", createInput("UAH"))).toEqual({
      ok: false,
      error: "SUPPLIER_UNAVAILABLE",
    });
  });

  it("20. USD is still rejected (schema and service)", async () => {
    expect(createPurchaseOrderSchema.safeParse(createInput("USD")).success).toBe(false);
    expect(await createPurchaseOrder("user-1", createInput("USD"))).toEqual({ ok: false, error: "CREATE_FAILED" });
    expect(state.orders).toHaveLength(0);
  });
});
