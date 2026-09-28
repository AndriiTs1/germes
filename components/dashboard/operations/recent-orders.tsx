import { Package } from "lucide-react";

import { OperationsCard } from "@/components/dashboard/operations/operations-card";
import { formatMoney } from "@/components/sales/format";
import { getOrderStatusLabel, ORDER_STATUS_STYLES } from "@/components/sales/order-status";
import { getRecentOrders } from "@/lib/services/dashboard/get-recent-orders";
import { INTL_LOCALE_MAP, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

const BUSINESS_TIME_ZONE = "Europe/Kyiv";

/** yyyy-mm-dd of an instant in Kyiv — used only to compare calendar days. */
const kyivDayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * "Today, 14:32" / "10 Sep, 16:05" / "10 Sep 2025, 16:05" — day, time and
 * "today" are all Europe/Kyiv, never the server's time zone; the year is
 * added only when it differs from the current Kyiv year.
 */
function formatTimestamp(
  iso: string,
  now: Date,
  locale: Locale,
  t: Dictionary["commandCenter"]["recentOrders"],
): { label: string; isToday: boolean } {
  const date = new Date(iso);
  const intlLocale = INTL_LOCALE_MAP[locale];
  const time = new Intl.DateTimeFormat(intlLocale, {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  const dayKey = kyivDayKey.format(date);
  const todayKey = kyivDayKey.format(now);
  if (dayKey === todayKey) {
    return { label: `${t.todayPrefix} ${time}`, isToday: true };
  }

  const sameYear = dayKey.slice(0, 4) === todayKey.slice(0, 4);
  const day = new Intl.DateTimeFormat(intlLocale, {
    timeZone: BUSINESS_TIME_ZONE,
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
  return { label: `${day}, ${time}`, isToday: false };
}

export async function RecentOrders({
  className,
  locale,
  dictionary,
}: {
  className?: string;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const t = dictionary.commandCenter.recentOrders;
  const recentOrders = await getRecentOrders();
  const now = new Date();

  return (
    <OperationsCard
      title={t.title}
      // min-w-0: a long customer name must truncate inside its grid track,
      // not widen this card and squeeze the neighbouring cards.
      className={cn("min-w-0", className)}
      action={
        <button
          type="button"
          className="text-[12px] font-medium text-slate-400 transition-colors hover:text-slate-700"
        >
          {dictionary.common.viewAll}
        </button>
      }
    >
      {recentOrders.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-2 py-6 text-center text-[12.5px] text-slate-400">
          {t.empty}
        </p>
      ) : null}
      <ul className={cn("flex flex-1 flex-col justify-between", recentOrders.length === 0 && "hidden")}>
        {recentOrders.map((order) => {
          const { label: timestamp, isToday } = formatTimestamp(order.orderDate, now, locale, t);
          const amount = formatMoney(order.amount, order.currency, locale);
          const status = (
            <span
              className={cn(
                "rounded-full px-1.5 py-px text-[10px] leading-tight font-semibold whitespace-nowrap",
                ORDER_STATUS_STYLES[order.status] ?? "bg-slate-100 text-slate-600",
              )}
            >
              {getOrderStatusLabel(dictionary.status.order, order.status)}
            </span>
          );
          return (
            <li key={order.id}>
              {/* >=768px: unchanged single-row layout */}
              <div className="hidden items-center gap-3 rounded-xl px-2 py-0.5 transition-colors hover:bg-slate-50 md:flex">
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    isToday ? "bg-blue-500" : "bg-slate-300",
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5 leading-tight">
                    <span className="shrink-0 text-[11.5px] font-medium text-slate-400">{order.orderNumber}</span>
                    <span className="truncate text-[12.5px] font-medium text-slate-900">
                      {order.customer}
                    </span>
                  </div>
                  <p className="text-[11px] leading-tight text-slate-400">{timestamp}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-[12.5px] leading-tight font-semibold whitespace-nowrap text-slate-900">
                    {amount}
                  </span>
                  {status}
                </div>
              </div>

              {/* <768px: unified mobile row — neutral icon chip, customer/amount primary, id+timestamp secondary metadata */}
              <div className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-slate-50 md:hidden">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-slate-100 text-slate-500">
                  <Package className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-slate-900">{order.customer}</p>
                  <p className="truncate text-[11px] text-slate-400">
                    {order.orderNumber} · {timestamp}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-[12.5px] leading-tight font-semibold whitespace-nowrap text-slate-900">
                    {amount}
                  </span>
                  {status}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </OperationsCard>
  );
}
