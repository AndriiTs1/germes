import { Package } from "lucide-react";

import { OperationsCard } from "@/components/dashboard/operations/operations-card";
import { recentOrders } from "@/components/dashboard/operations/operations-data";
import { INTL_LOCALE_MAP, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

/** "Today, 14:32" or "10 Sep, 16:05" — the day/time digits and demo meaning are unchanged; only "Today," and the month name are locale-aware. */
function formatTimestamp(
  order: (typeof recentOrders)[number],
  locale: Locale,
  t: Dictionary["commandCenter"]["recentOrders"],
): string {
  if (order.isToday) {
    return `${t.todayPrefix} ${order.time}`;
  }
  const monthLabel = new Intl.DateTimeFormat(INTL_LOCALE_MAP[locale], { month: "short" }).format(
    new Date(Date.UTC(2000, order.monthIndex ?? 0, 1)),
  );
  return `${order.day} ${monthLabel}, ${order.time}`;
}

export function RecentOrders({
  className,
  locale,
  dictionary,
}: {
  className?: string;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const t = dictionary.commandCenter.recentOrders;

  return (
    <OperationsCard
      title={t.title}
      className={className}
      action={
        <button
          type="button"
          className="text-[12px] font-medium text-slate-400 transition-colors hover:text-slate-700"
        >
          {dictionary.common.viewAll}
        </button>
      }
    >
      <ul className="flex flex-1 flex-col justify-between">
        {recentOrders.map((order) => {
          const timestamp = formatTimestamp(order, locale, t);
          return (
            <li key={order.id}>
              {/* >=768px: unchanged single-row layout */}
              <div className="hidden items-center gap-3 rounded-xl px-2 py-0.5 transition-colors hover:bg-slate-50 md:flex">
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    order.isToday ? "bg-blue-500" : "bg-slate-300",
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5 leading-tight">
                    <span className="shrink-0 text-[11.5px] font-medium text-slate-400">{order.id}</span>
                    <span className="truncate text-[12.5px] font-medium text-slate-900">
                      {order.customer}
                    </span>
                  </div>
                  <p className="text-[11px] leading-tight text-slate-400">{timestamp}</p>
                </div>
                <span className="shrink-0 text-[12.5px] font-semibold text-slate-900">{order.amount}</span>
              </div>

              {/* <768px: unified mobile row — neutral icon chip, customer/amount primary, id+timestamp secondary metadata */}
              <div className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-slate-50 md:hidden">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-slate-100 text-slate-500">
                  <Package className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-slate-900">{order.customer}</p>
                  <p className="truncate text-[11px] text-slate-400">
                    {order.id} · {timestamp}
                  </p>
                </div>
                <span className="shrink-0 text-[12.5px] font-semibold text-slate-900">{order.amount}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </OperationsCard>
  );
}
