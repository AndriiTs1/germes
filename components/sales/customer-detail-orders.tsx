import Link from "next/link";

import { DetailSection } from "@/components/sales/detail-section";
import { formatKg, formatMoney, formatShortDate } from "@/components/sales/format";
import { getOrderStatusLabel, ORDER_STATUS_STYLES } from "@/components/sales/order-status";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { SalesCustomerDetailOrder } from "@/lib/services/sales/get-sales-customer-detail";
import { cn } from "@/lib/utils";

function StatusBadge({ status, statusLabels }: { status: string; statusLabels: Dictionary["status"]["order"] }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap",
        ORDER_STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600",
      )}
    >
      {getOrderStatusLabel(statusLabels, status)}
    </span>
  );
}

/**
 * Latest 5 orders only (enforced by the service, not here) — this is
 * deliberately not a full order-history page. No "View all" link: no
 * customer-filtered orders route exists yet, and a link to one would be a
 * placeholder route, which this stage explicitly forbids.
 */
export function CustomerDetailOrders({
  orders,
  locale,
  dictionary,
}: {
  orders: SalesCustomerDetailOrder[];
  locale: Locale;
  dictionary: Dictionary;
}) {
  const t = dictionary.customerDetail.recentOrders;
  const tableLabels = dictionary.common.table;

  if (orders.length === 0) {
    return (
      <DetailSection title={t.title}>
        <p className="text-[13px] text-slate-400">{t.empty}</p>
      </DetailSection>
    );
  }

  return (
    <DetailSection title={t.title}>
      <div className="hidden lg:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
              <th scope="col" className="py-2 pr-4">
                {tableLabels.order}
              </th>
              <th scope="col" className="py-2 pr-4">
                {tableLabels.status}
              </th>
              <th scope="col" className="py-2 pr-4">
                {tableLabels.date}
              </th>
              <th scope="col" className="py-2 pr-4 text-right">
                {tableLabels.quantity}
              </th>
              <th scope="col" className="py-2 text-right">
                {tableLabels.total}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr key={order.id} className="text-[13px]">
                <td className="max-w-[160px] truncate py-2.5 pr-4 font-medium text-slate-900">
                  <Link
                    href={`/sales/orders/${order.id}`}
                    className="rounded-sm text-slate-900 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none"
                  >
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="py-2.5 pr-4">
                  <StatusBadge status={order.status} statusLabels={dictionary.status.order} />
                </td>
                <td className="py-2.5 pr-4 whitespace-nowrap text-slate-500">
                  {formatShortDate(order.orderDate, locale)}
                </td>
                <td className="py-2.5 pr-4 text-right whitespace-nowrap text-slate-700">
                  {formatKg(order.totalQuantityKg, locale)} {dictionary.common.kgUnit}
                </td>
                <td className="py-2.5 text-right whitespace-nowrap font-semibold text-slate-900">
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
              className="block rounded-xl border border-slate-100 p-3 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-semibold text-slate-900">
                  {order.orderNumber}
                </span>
                <StatusBadge status={order.status} statusLabels={dictionary.status.order} />
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11.5px] text-slate-400">
                <span className="truncate">
                  {formatShortDate(order.orderDate, locale)} ·{" "}
                  {formatKg(order.totalQuantityKg, locale)} {dictionary.common.kgUnit}
                </span>
                <span className="shrink-0 text-[12.5px] font-semibold text-slate-900">
                  {formatMoney(order.totalValue, order.currency, locale)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </DetailSection>
  );
}
