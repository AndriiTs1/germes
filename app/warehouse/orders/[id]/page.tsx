import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getOrderStatusLabel, ORDER_STATUS_STYLES } from "@/components/sales/order-status";
import { WarehouseOrderActions } from "@/components/warehouse/warehouse-order-actions";
import { WarehouseOrderItems } from "@/components/warehouse/warehouse-order-items";
import { WarehouseOrderOverview } from "@/components/warehouse/warehouse-order-overview";
import { WarehouseOrderReservations } from "@/components/warehouse/warehouse-order-reservations";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getWarehouseOrderDetail } from "@/lib/services/warehouse/get-warehouse-order-detail";
import { cn } from "@/lib/utils";

const WAREHOUSE_WORKSPACE_PERMISSION = "inventory.shipments.process";

export default async function WarehouseOrderDetailPage(
  props: PageProps<"/warehouse/orders/[id]">,
) {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    // Same reasoning as every other workspace route: any failure here
    // (unauthenticated or missing this permission) is safest resolved by
    // "/", which re-derives the correct destination from the user's real
    // permissions.
    user = await requirePermission(WAREHOUSE_WORKSPACE_PERMISSION);
  } catch {
    redirect("/");
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);

  const locale = await getCurrentLocale();
  const dictionary = getDictionary(locale);

  const { id } = await props.params;

  // getWarehouseOrderDetail applies no ownership scoping (Warehouse works
  // across salespeople) — it returns null only when the order doesn't
  // exist or is outside Warehouse's lifecycle scope (DRAFT/COMPLETED/
  // CANCELLED). No Sales expiration housekeeping runs on this route.
  const order = await getWarehouseOrderDetail(id);

  if (!order) {
    notFound();
  }

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath={`/warehouse/orders/${order.id}`}
      dictionary={dictionary}
      showPeriodControl={false}
    >
      <div className="pb-4">
        <Link
          href="/warehouse"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          {dictionary.warehouse.orderDetail.backToWarehouse}
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
              {order.orderNumber}
            </h1>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap",
                ORDER_STATUS_STYLES[order.status] ?? "bg-slate-100 text-slate-600",
              )}
            >
              {getOrderStatusLabel(dictionary.status.order, order.status)}
            </span>
          </div>

          <WarehouseOrderActions
            orderId={order.id}
            status={order.status}
            dictionary={dictionary.warehouse.orderDetail.actions}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <WarehouseOrderOverview order={order} locale={locale} dictionary={dictionary} />
        <WarehouseOrderItems items={order.items} orderStatus={order.status} locale={locale} dictionary={dictionary} />
        <WarehouseOrderReservations reservations={order.reservations} locale={locale} dictionary={dictionary} />
      </div>
    </DashboardShell>
  );
}
