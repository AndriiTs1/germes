import { Package } from "lucide-react";

import { formatKg, formatMoney, formatShortDate } from "@/components/sales/format";
import { ORDER_STATUS_LABELS, ORDER_STATUS_STYLES } from "@/components/sales/order-status";
import type { SalesOrderListItem } from "@/lib/services/sales/list-sales-orders";
import { cn } from "@/lib/utils";

type OrdersListProps = {
  orders: SalesOrderListItem[];
  emptyMessage: string;
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
 * >=1024px: a real <table> (native column semantics/accessibility for a
 * genuinely tabular view). <1024px (tablet + mobile, per the manually
 * verified /sales breakpoints): compact cards — a table only "prefers"
 * columns at desktop widths, per spec, not shrunk until unreadable.
 */
export function OrdersList({ orders, emptyMessage }: OrdersListProps) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200/70 bg-white px-4 py-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]">
        <Package className="h-5 w-5 text-slate-300" strokeWidth={1.75} />
        <p className="text-[13px] font-medium text-slate-500">{emptyMessage}</p>
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
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Date
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Quantity
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr key={order.id} className="text-[13px]">
                <td className="max-w-[140px] truncate px-4 py-3 font-medium text-slate-900">
                  {order.orderNumber}
                </td>
                <td className="max-w-[240px] truncate px-4 py-3 text-slate-700">
                  {order.customerName}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                  {formatShortDate(order.orderDate)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap text-slate-700">
                  {formatKg(order.totalQuantityKg)} kg
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-slate-900">
                  {formatMoney(order.totalValue, order.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 lg:hidden">
        {orders.map((order) => (
          <li
            key={order.id}
            className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[13px] font-semibold text-slate-900">
                {order.orderNumber}
              </span>
              <StatusBadge status={order.status} />
            </div>
            <p className="mt-1 truncate text-[12.5px] text-slate-600">{order.customerName}</p>
            <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px] text-slate-400">
              <span className="truncate">
                {formatShortDate(order.orderDate)} · {formatKg(order.totalQuantityKg)} kg
              </span>
              <span className="shrink-0 text-[13px] font-semibold text-slate-900">
                {formatMoney(order.totalValue, order.currency)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
