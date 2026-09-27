import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  updatePurchaseOrder: vi.fn(),
  transitionPurchaseOrderStatus: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/permissions/require-permission", () => ({ requirePermission: m.requirePermission }));
vi.mock("@/lib/i18n/locale", () => ({ getCurrentLocale: async () => "uk" }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/lib/services/procurement/update-purchase-order", () => ({ updatePurchaseOrder: m.updatePurchaseOrder }));
vi.mock("@/lib/services/procurement/transition-purchase-order-status", () => ({
  transitionPurchaseOrderStatus: m.transitionPurchaseOrderStatus,
}));

import { cancelPurchaseOrderAction, confirmPurchaseOrderAction } from "@/app/procurement/orders/[id]/actions";
import { updatePurchaseOrderAction } from "@/app/procurement/orders/[id]/edit/actions";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const t = getDictionary("uk").procurement.orderActions;

const formInput = {
  supplierId: "11111111-1111-4111-8111-111111111111",
  currency: "UAH",
  items: [{ productId: "33333333-3333-4333-8333-333333333333", quantityKg: "1000", pricePerKg: "160" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  m.requirePermission.mockResolvedValue({ id: "user-1" });
  m.updatePurchaseOrder.mockResolvedValue({ ok: true });
  m.transitionPurchaseOrderStatus.mockResolvedValue({ ok: true, fromStatus: "DRAFT", toStatus: "CONFIRMED" });
});

describe("authorization at the action layer", () => {
  it("6. update without procurement.orders.update is rejected; service never called", async () => {
    m.requirePermission.mockRejectedValue(new Error("Forbidden"));
    const result = await updatePurchaseOrderAction("po-1", "2026-09-27T09:00:00.000Z", formInput);

    expect(result).toEqual({ error: t.saveGenericError });
    expect(m.requirePermission).toHaveBeenCalledWith("procurement.orders.update");
    expect(m.updatePurchaseOrder).not.toHaveBeenCalled();
  });

  it("17. cancel without procurement.orders.update is rejected; service never called", async () => {
    m.requirePermission.mockRejectedValue(new Error("Forbidden"));
    const result = await cancelPurchaseOrderAction("po-1");

    expect(result).toEqual({ error: t.transitionGenericError });
    expect(m.requirePermission).toHaveBeenCalledWith("procurement.orders.update");
    expect(m.transitionPurchaseOrderStatus).not.toHaveBeenCalled();
  });

  it("confirm without the permission is rejected too", async () => {
    m.requirePermission.mockRejectedValue(new Error("Forbidden"));
    expect(await confirmPurchaseOrderAction("po-1")).toEqual({ error: t.transitionGenericError });
    expect(m.transitionPurchaseOrderStatus).not.toHaveBeenCalled();
  });
});

describe("action wiring", () => {
  it("update validates server-side: USD never reaches the service", async () => {
    const result = await updatePurchaseOrderAction("po-1", "2026-09-27T09:00:00.000Z", { ...formInput, currency: "USD" });
    expect(result).toEqual({ error: t.saveGenericError });
    expect(m.updatePurchaseOrder).not.toHaveBeenCalled();
  });

  it("update maps a non-DRAFT rejection to a localized message", async () => {
    m.updatePurchaseOrder.mockResolvedValue({ ok: false, error: "ORDER_NOT_EDITABLE" });
    expect(await updatePurchaseOrderAction("po-1", "x", formInput)).toEqual({ error: t.orderNotEditable });
  });

  it("successful update passes the user id, revalidates and redirects to the detail page", async () => {
    await updatePurchaseOrderAction("po-1", "2026-09-27T09:00:00.000Z", formInput);
    expect(m.updatePurchaseOrder).toHaveBeenCalledWith(
      "user-1",
      "po-1",
      "2026-09-27T09:00:00.000Z",
      expect.objectContaining({ currency: "UAH" }),
    );
    expect(m.revalidatePath.mock.calls.map((c) => c[0])).toEqual([
      "/procurement",
      "/procurement/orders",
      "/procurement/orders/po-1",
    ]);
    expect(m.redirect).toHaveBeenCalledWith("/procurement/orders/po-1");
  });

  it("confirm/cancel call the transition with the right kind and revalidate", async () => {
    await confirmPurchaseOrderAction("po-1");
    await cancelPurchaseOrderAction("po-1");
    expect(m.transitionPurchaseOrderStatus.mock.calls).toEqual([
      ["user-1", "po-1", "CONFIRM"],
      ["user-1", "po-1", "CANCEL"],
    ]);
    expect(m.revalidatePath).toHaveBeenCalledWith("/procurement/orders/po-1");
  });

  it("maps SUPPLIER_NOT_ACTIVE on confirm to the localized active-supplier message", async () => {
    m.transitionPurchaseOrderStatus.mockResolvedValue({ ok: false, error: "SUPPLIER_NOT_ACTIVE" });
    expect(await confirmPurchaseOrderAction("po-1")).toEqual({ error: t.supplierNotActive });
    expect(t.supplierNotActive).toBe("Підтвердити замовлення можна лише для активного постачальника.");
  });

  it("maps a status race to the localized stale message", async () => {
    m.transitionPurchaseOrderStatus.mockResolvedValue({ ok: false, error: "STATUS_CHANGED" });
    expect(await confirmPurchaseOrderAction("po-1")).toEqual({ error: t.statusChanged });
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });
});
