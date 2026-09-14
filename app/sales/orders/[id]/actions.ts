"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions/require-permission";
import { createStockReservation } from "@/lib/services/sales/create-stock-reservation";
import { releaseStockReservation } from "@/lib/services/sales/release-stock-reservation";
import {
  transitionSalesOrderStatus,
  type SalesOrderTransition,
} from "@/lib/services/sales/transition-sales-order-status";

const SALES_ORDERS_UPDATE_PERMISSION = "sales.orders.update";
const RESERVATIONS_CREATE_PERMISSION = "sales.reservations.create";
const RESERVATIONS_RELEASE_PERMISSION = "sales.reservations.release";

const GENERIC_TRANSITION_ERROR =
  "Could not update the order. Please try again.";

export type ReservationActionState = {
  ok: boolean;
  message: string | null;
};

const createReservationSchema = z.object({
  orderId: z.string().uuid(),
  salesOrderItemId: z.string().uuid(),
  allocation: z
    .string()
    .min(1, "Select a batch and warehouse.")
    .refine((value) => value.split(":").length === 2, {
      message: "Select a batch and warehouse.",
    }),
  quantityKg: z
    .string()
    .trim()
    .regex(/^\d+([.,]\d{1,3})?$/, {
      message: "Enter a valid quantity with up to 3 decimals.",
    }),
});

const releaseReservationSchema = z.object({
  orderId: z.string().uuid(),
  reservationId: z.string().uuid(),
});

function revalidateReservationPaths(orderId: string) {
  revalidatePath("/sales");
  revalidatePath("/sales/orders");
  revalidatePath(`/sales/orders/${orderId}`);
}

async function runOrderTransition(
  orderId: string,
  transition: SalesOrderTransition,
): Promise<{ error: string } | void> {
  const user = await requirePermission(
    SALES_ORDERS_UPDATE_PERMISSION,
  ).catch(() => null);

  if (!user) {
    return { error: GENERIC_TRANSITION_ERROR };
  }

  const result = await transitionSalesOrderStatus(
    user.id,
    orderId,
    transition,
  );

  if (!result.ok) {
    return { error: GENERIC_TRANSITION_ERROR };
  }

  revalidatePath("/sales");
  revalidatePath("/sales/orders");
  revalidatePath(`/sales/orders/${orderId}`);
  revalidatePath("/sales/customers");
  revalidatePath(`/sales/customers/${result.customerId}`);
}

export async function confirmSalesOrderAction(
  orderId: string,
): Promise<{ error: string } | void> {
  return runOrderTransition(orderId, "CONFIRM");
}

export async function cancelSalesOrderAction(
  orderId: string,
): Promise<{ error: string } | void> {
  return runOrderTransition(orderId, "CANCEL");
}

export async function createStockReservationAction(
  _previousState: ReservationActionState,
  formData: FormData,
): Promise<ReservationActionState> {
  const user = await requirePermission(
    RESERVATIONS_CREATE_PERMISSION,
  ).catch(() => null);

  if (!user) {
    return {
      ok: false,
      message: "You do not have permission to create reservations.",
    };
  }

  const parsed = createReservationSchema.safeParse({
    orderId: formData.get("orderId"),
    salesOrderItemId: formData.get("salesOrderItemId"),
    allocation: formData.get("allocation"),
    quantityKg: formData.get("quantityKg"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Check the reservation details.",
    };
  }

  const [batchId, warehouseId] = parsed.data.allocation.split(":");

  if (!batchId || !warehouseId) {
    return {
      ok: false,
      message: "Select a batch and warehouse.",
    };
  }

  const result = await createStockReservation(user.id, {
    salesOrderId: parsed.data.orderId,
    salesOrderItemId: parsed.data.salesOrderItemId,
    batchId,
    warehouseId,
    quantityKg: parsed.data.quantityKg.replace(",", "."),
  });

  if (!result.ok) {
    return {
      ok: false,
      message: "Could not create the reservation.",
    };
  }

  revalidateReservationPaths(parsed.data.orderId);

  return {
    ok: true,
    message: "Stock reserved successfully.",
  };
}

export async function releaseStockReservationAction(
  _previousState: ReservationActionState,
  formData: FormData,
): Promise<ReservationActionState> {
  const user = await requirePermission(
    RESERVATIONS_RELEASE_PERMISSION,
  ).catch(() => null);

  if (!user) {
    return {
      ok: false,
      message: "You do not have permission to release reservations.",
    };
  }

  const parsed = releaseReservationSchema.safeParse({
    orderId: formData.get("orderId"),
    reservationId: formData.get("reservationId"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Could not release the reservation.",
    };
  }

  const result = await releaseStockReservation(
    user.id,
    parsed.data.reservationId,
  );

  if (!result.ok) {
    return {
      ok: false,
      message: "Could not release the reservation.",
    };
  }

  revalidateReservationPaths(parsed.data.orderId);

  return {
    ok: true,
    message: "Reservation released.",
  };
}
