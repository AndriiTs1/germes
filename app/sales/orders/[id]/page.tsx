import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ORDER_STATUS_LABELS, ORDER_STATUS_STYLES } from "@/components/sales/order-status";
import { OrderDetailActions } from "@/components/sales/order-detail-actions";
import { OrderDetailItems } from "@/components/sales/order-detail-items";
import { OrderDetailNotes } from "@/components/sales/order-detail-notes";
import { OrderDetailOverview } from "@/components/sales/order-detail-overview";
import { OrderDetailReceivable } from "@/components/sales/order-detail-receivable";
import { OrderDetailReservations } from "@/components/sales/order-detail-reservations";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { expireStockReservations } from "@/lib/services/sales/expire-stock-reservations";
import { getBatchWarehouseAvailability } from "@/lib/services/sales/get-batch-warehouse-availability";
import { getSalesOrderDetail } from "@/lib/services/sales/get-sales-order-detail";
import { cn } from "@/lib/utils";

const SALES_ORDERS_PERMISSION = "sales.orders.read";
const SALES_ORDERS_UPDATE_PERMISSION = "sales.orders.update";
const RESERVATIONS_READ_PERMISSION = "sales.reservations.read";
const RESERVATIONS_CREATE_PERMISSION = "sales.reservations.create";
const RESERVATIONS_RELEASE_PERMISSION = "sales.reservations.release";

export default async function SalesOrderDetailPage(props: PageProps<"/sales/orders/[id]">) {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    // Same reasoning as /sales and /sales/orders: any failure here
    // (unauthenticated or missing this permission) is safest resolved by
    // "/", which re-derives the correct destination from the user's real
    // permissions.
    user = await requirePermission(SALES_ORDERS_PERMISSION);
  } catch {
    redirect("/");
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);
  const canUpdate = permissionCodes.includes(SALES_ORDERS_UPDATE_PERMISSION);
  const canReadReservations = permissionCodes.includes(
    RESERVATIONS_READ_PERMISSION,
  );
  const canCreateReservations = permissionCodes.includes(
    RESERVATIONS_CREATE_PERMISSION,
  );
  const canReleaseReservations = permissionCodes.includes(
    RESERVATIONS_RELEASE_PERMISSION,
  );

  if (canReadReservations || canCreateReservations) {
    await expireStockReservations();
  }

  const { id } = await props.params;
  const order = await getSalesOrderDetail(user.id, id);

  // getSalesOrderDetail returns null for BOTH "no such order" and "order
  // belongs to another salesperson" — the exact same query, no separate
  // existence check — so both resolve to the identical notFound() here.
  if (!order) {
    notFound();
  }

  const canCreateForOrder =
    canCreateReservations && order.status === "CONFIRMED";

  const reservationAvailability = canCreateForOrder
    ? await Promise.all(
        order.items.map(async (item) => ({
          salesOrderItemId: item.id,
          productName: item.productName,
          orderedQuantityKg: item.quantityKg,
          allocations: await getBatchWarehouseAvailability(item.productId),
        })),
      )
    : [];

  const showReservations =
    (canReadReservations && order.reservations.length > 0) ||
    canCreateForOrder;

  const hasSecondaryRow =
    showReservations || order.receivable !== null;

  const hasNotes = order.notes !== null && order.notes.trim() !== "";

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath={`/sales/orders/${order.id}`}
      showPeriodControl={false}
    >
      <div className="pb-4 xl:pb-3">
        <Link
          href="/sales/orders"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Back to Orders
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5] xl:leading-[1.2]">
              {order.orderNumber}
            </h1>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap",
                ORDER_STATUS_STYLES[order.status] ?? "bg-slate-100 text-slate-600",
              )}
            >
              {ORDER_STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>

          <OrderDetailActions orderId={order.id} status={order.status} canUpdate={canUpdate} />
        </div>
      </div>

      <div className="flex flex-col gap-4 xl:gap-3">
        <OrderDetailOverview order={order} />
        <OrderDetailItems items={order.items} currency={order.currency} />

        {hasSecondaryRow ? (
          <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-2 xl:items-start xl:gap-3">
            {showReservations ? (
              <OrderDetailReservations
                orderId={order.id}
                reservations={order.reservations}
                availability={reservationAvailability}
                canCreate={canCreateForOrder}
                canRelease={canReleaseReservations}
              />
            ) : null}
            {order.receivable ? <OrderDetailReceivable receivable={order.receivable} /> : null}
          </div>
        ) : null}

        {hasNotes ? <OrderDetailNotes notes={order.notes as string} /> : null}
      </div>
    </DashboardShell>
  );
}
