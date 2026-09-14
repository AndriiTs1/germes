import { Package } from "lucide-react";
import Link from "next/link";

import { formatKg, formatShortDate } from "@/components/sales/format";
import { ORDER_STATUS_LABELS, ORDER_STATUS_STYLES } from "@/components/sales/order-status";
import type { WarehouseOrderQueueItem } from "@/lib/services/warehouse/list-warehouse-orders";
import { cn } from "@/lib/utils";

type FulfillmentQueueProps = {
  orders: WarehouseOrderQueueItem[];
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap",
        ORDER_STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600",
      )}
    >
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}

/**
 * No invented business status — isFullyReserved and
 * fullyReservedItemCount/totalItemCount come straight from
 * listWarehouseOrders. "Fully reserved" is a compact positive indicator;
 * otherwise a neutral/warning "X / Y items reserved" reflects the real
 * per-item fulfillment count.
 */
function FulfillmentBadge({ order }: { order: WarehouseOrderQueueItem }) {
  if (order.isFullyReserved) {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap text-emerald-600">
        Fully reserved
      </span>
    );
  }

  return (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap text-amber-600">
      {order.fullyReservedItemCount} / {order.totalItemCount} items reserved
    </span>
  );
}

/**
 * >=1024px: a real <table>. <1024px (tablet + mobile): compact cards —
 * same split convention already established by OrdersList/
 * OrderDetailItems. Each row/card now links to the real Warehouse order
 * detail route (W3) via next/link — never window.location. No lifecycle
 * action buttons here; those live only on the detail page.
 */
export function FulfillmentQueue({ orders }: FulfillmentQueueProps) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200/70 bg-white px-4 py-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]">
        <Package className="h-5 w-5 text-slate-300" strokeWidth={1.75} />
        <p className="text-[13px] font-medium text-slate-500">
          No orders awaiting warehouse fulfillment
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)] lg:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
              <th scope="col" className="px-4 py-3">
                Order
              </th>
              <th scope="col" className="px-4 py-3">
                Customer
              </th>
              <th scope="col" className="px-4 py-3">
                Requested
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Quantity
              </th>
              <th scope="col" className="px-4 py-3">
                Fulfillment
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr key={order.id} className="text-[13px] transition-colors hover:bg-slate-50">
                <td className="max-w-[140px] truncate px-4 py-3 font-medium text-slate-900">
                  <Link
                    href={`/warehouse/orders/${order.id}`}
                    className="rounded-sm text-slate-900 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none"
                  >
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="max-w-[220px] truncate px-4 py-3 text-slate-700">
                  {order.customer.name}
                  <span className="ml-1.5 text-slate-400">{order.customer.code}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                  {order.requestedDate ? formatShortDate(order.requestedDate) : "—"}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap text-slate-700">
                  {formatKg(order.totalQuantityKg)} kg
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <FulfillmentBadge order={order} />
                    <span className="text-[11px] whitespace-nowrap text-slate-400">
                      {formatKg(order.reservedQuantityKg)} / {formatKg(order.totalQuantityKg)} kg
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 lg:hidden">
        {orders.map((order) => (
          <li key={order.id}>
            <Link
              href={`/warehouse/orders/${order.id}`}
              className="block rounded-2xl border border-slate-200/70 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)] transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-semibold text-slate-900">
                  {order.orderNumber}
                </span>
                <StatusBadge status={order.status} />
              </div>

              <p className="mt-1 truncate text-[12.5px] text-slate-600">
                {order.customer.name}{" "}
                <span className="text-slate-400">{order.customer.code}</span>
              </p>

              <p className="mt-1 truncate text-[11.5px] text-slate-400">
                {order.requestedDate ? formatShortDate(order.requestedDate) : "No requested date"}
                {" · "}
                {formatKg(order.totalQuantityKg)} kg
              </p>

              <div className="mt-2 flex items-center justify-between gap-2">
                <FulfillmentBadge order={order} />
                <span className="text-[11px] whitespace-nowrap text-slate-400">
                  {formatKg(order.reservedQuantityKg)} / {formatKg(order.totalQuantityKg)} kg
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
