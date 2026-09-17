import Link from "next/link";
import { Package } from "lucide-react";

import { formatKg, formatMoney, formatShortDate } from "@/components/sales/format";
import { getOrderStatusLabel, ORDER_STATUS_STYLES } from "@/components/sales/order-status";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { SalesOrderListItem } from "@/lib/services/sales/list-sales-orders";
import { cn } from "@/lib/utils";

type OrdersListProps = {
  orders: SalesOrderListItem[];
  emptyMessage: string;
  locale: Locale;
  dictionary: Dictionary;
};

function StatusBadge({ status, statusLabels }: { status: string; statusLabels: Dictionary["status"]["order"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap",
        ORDER_STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600",
      )}
    >
      {getOrderStatusLabel(statusLabels, status)}
    </span>
  );
}

/**
 * >=1024px: a real <table> (native column semantics/accessibility for a
 * genuinely tabular view). <1024px (tablet + mobile, per the manually
 * verified /sales breakpoints): compact cards — a table only "prefers"
 * columns at desktop widths, per spec, not shrunk until unreadable.
 */
export function OrdersList({ orders, emptyMessage, locale, dictionary }: OrdersListProps) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200/70 bg-white px-4 py-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]">
        <Package className="h-5 w-5 text-slate-300" strokeWidth={1.75} />
        <p className="text-[13px] font-medium text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  const t = dictionary.common.table;

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)] lg:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
              <th scope="col" className="px-4 py-3">
                {t.order}
              </th>
              <th scope="col" className="px-4 py-3">
                {t.customer}
              </th>
              <th scope="col" className="px-4 py-3">
                {t.status}
              </th>
              <th scope="col" className="px-4 py-3">
                {t.date}
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                {t.quantity}
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                {t.total}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr key={order.id} className="text-[13px] transition-colors hover:bg-slate-50">
                <td className="max-w-[140px] truncate px-4 py-3 font-medium text-slate-900">
                  <Link
                    href={`/sales/orders/${order.id}`}
                    className="rounded-sm text-slate-900 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none"
                  >
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="max-w-[240px] truncate px-4 py-3 text-slate-700">
                  {order.customerName}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} statusLabels={dictionary.status.order} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                  {formatShortDate(order.orderDate, locale)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap text-slate-700">
                  {formatKg(order.totalQuantityKg, locale)} {dictionary.common.kgUnit}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-slate-900">
                  {formatMoney(order.totalValue, order.currency, locale)}
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
              href={`/sales/orders/${order.id}`}
              className="block rounded-2xl border border-slate-200/70 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)] transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-semibold text-slate-900">
                  {order.orderNumber}
                </span>
                <StatusBadge status={order.status} statusLabels={dictionary.status.order} />
              </div>
              <p className="mt-1 truncate text-[12.5px] text-slate-600">{order.customerName}</p>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px] text-slate-400">
                <span className="truncate">
                  {formatShortDate(order.orderDate, locale)} ·{" "}
                  {formatKg(order.totalQuantityKg, locale)} {dictionary.common.kgUnit}
                </span>
                <span className="shrink-0 text-[13px] font-semibold text-slate-900">
                  {formatMoney(order.totalValue, order.currency, locale)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
