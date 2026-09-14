"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions/require-permission";
import { markSalesOrderReady } from "@/lib/services/warehouse/mark-sales-order-ready";
import { shipSalesOrder } from "@/lib/services/warehouse/ship-sales-order";
import { startSalesOrderProcessing } from "@/lib/services/warehouse/start-sales-order-processing";

const WAREHOUSE_PERMISSION = "inventory.shipments.process";

const orderIdSchema = z.uuid();

export type WarehouseOrderActionState = {
  ok: boolean;
  message: string | null;
};

/**
 * Warehouse status changes must become visible to Sales too — both
 * workspaces read the same SalesOrder. Customer detail is deliberately not
 * revalidated here: none of the three warehouse services return a
 * customerId, and adding a query solely to discover one for revalidation
 * would be an extra DB round trip with no other purpose.
 */
function revalidateWarehouseOrderPaths(orderId: string) {
  revalidatePath("/warehouse");
  revalidatePath(`/warehouse/orders/${orderId}`);
  revalidatePath("/sales");
  revalidatePath("/sales/orders");
  revalidatePath(`/sales/orders/${orderId}`);
}

/**
 * Each action independently requires inventory.shipments.process — never
 * relies on the page's own permission check. orderId is strictly validated
 * as a UUID before ever reaching a service. The three warehouse lifecycle
 * services (startSalesOrderProcessing/markSalesOrderReady/shipSalesOrder)
 * remain the sole source of lifecycle-rule truth; this layer only wires
 * them and translates their result into a safe, generic message — it never
 * leaks an internal service error code.
 */
export async function startProcessingAction(
  orderId: string,
): Promise<WarehouseOrderActionState> {
  const user = await requirePermission(WAREHOUSE_PERMISSION).catch(() => null);

  if (!user) {
    return { ok: false, message: "Could not start order processing." };
  }

  const parsed = orderIdSchema.safeParse(orderId);

  if (!parsed.success) {
    return { ok: false, message: "Could not start order processing." };
  }

  const result = await startSalesOrderProcessing(user.id, parsed.data);

  if (!result.ok) {
    return { ok: false, message: "Could not start order processing." };
  }

  revalidateWarehouseOrderPaths(parsed.data);

  return { ok: true, message: "Order processing started." };
}

export async function markReadyAction(orderId: string): Promise<WarehouseOrderActionState> {
  const user = await requirePermission(WAREHOUSE_PERMISSION).catch(() => null);

  if (!user) {
    return { ok: false, message: "Could not mark the order ready." };
  }

  const parsed = orderIdSchema.safeParse(orderId);

  if (!parsed.success) {
    return { ok: false, message: "Could not mark the order ready." };
  }

  const result = await markSalesOrderReady(user.id, parsed.data);

  if (!result.ok) {
    return { ok: false, message: "Could not mark the order ready." };
  }

  revalidateWarehouseOrderPaths(parsed.data);

  return { ok: true, message: "Order marked ready." };
}

export async function shipOrderAction(orderId: string): Promise<WarehouseOrderActionState> {
  const user = await requirePermission(WAREHOUSE_PERMISSION).catch(() => null);

  if (!user) {
    return { ok: false, message: "Could not ship the order." };
  }

  const parsed = orderIdSchema.safeParse(orderId);

  if (!parsed.success) {
    return { ok: false, message: "Could not ship the order." };
  }

  const result = await shipSalesOrder(user.id, parsed.data);

  if (!result.ok) {
    return { ok: false, message: "Could not ship the order." };
  }

  // Stay on the detail page and show SHIPPED — no redirect. The detail
  // route remains valid because getWarehouseOrderDetail includes SHIPPED.
  revalidateWarehouseOrderPaths(parsed.data);

  return { ok: true, message: "Order shipped successfully." };
}
