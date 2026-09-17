import Link from "next/link";
import { Package } from "lucide-react";

import { OperationsCard } from "@/components/dashboard/operations/operations-card";
import { formatKg, formatMoney, formatShortDate } from "@/components/sales/format";
import { getOrderStatusLabel, ORDER_STATUS_STYLES } from "@/components/sales/order-status";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { SalesOrderListItem } from "@/lib/services/sales/list-sales-orders";
import { cn } from "@/lib/utils";

export function ActiveOrdersCard({
  orders,
  locale,
  dictionary,
  className,
}: {
  orders: SalesOrderListItem[];
  locale: Locale;
  dictionary: Dictionary;
  className?: string;
}) {
  return (
    <OperationsCard
      title={dictionary.sales.workspace.kpi.activeOrders}
      className={className}
      action={
        <Link
          href="/sales/orders"
          className="text-[12px] font-medium text-slate-400 transition-colors hover:text-slate-700"
        >
          {dictionary.common.viewAll}
        </Link>
      }
    >
      {orders.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-6 text-center">
          <Package className="h-5 w-5 text-slate-300 xl:h-4 xl:w-4" strokeWidth={1.75} />
          <p className="text-[12.5px] font-medium text-slate-500 xl:text-[12px]">
            {dictionary.sales.workspace.activeOrdersEmpty}
          </p>
        </div>
      ) : (
        <ul className="flex flex-1 flex-col gap-1 overflow-y-auto xl:gap-0 xl:divide-y xl:divide-slate-100">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/sales/orders/${order.id}`}
                className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="shrink-0 text-[11.5px] font-medium text-slate-400">
                      {order.orderNumber}
                    </span>
                    <span className="truncate text-[12.5px] font-medium text-slate-900 xl:font-semibold">
                      {order.customerName}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {formatShortDate(order.orderDate, locale)} ·{" "}
                    {formatKg(order.totalQuantityKg, locale)} {dictionary.common.kgUnit}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 xl:min-w-[92px]">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap",
                      ORDER_STATUS_STYLES[order.status] ?? "bg-slate-100 text-slate-600",
                    )}
                  >
                    {getOrderStatusLabel(dictionary.status.order, order.status)}
                  </span>
                  <span className="text-[12.5px] font-semibold whitespace-nowrap text-slate-900">
                    {formatMoney(order.totalValue, order.currency, locale)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </OperationsCard>
  );
}
