import { ClipboardList, SearchX } from "lucide-react";
import Link from "next/link";

import {
  getPurchaseOrderStatusLabel,
  PURCHASE_ORDER_STATUS_STYLES,
} from "@/components/procurement/purchase-order-status";
import { formatKg, formatMoney, formatShortDate } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { pluralize } from "@/lib/i18n/pluralize";
import type { PurchaseOrderListItem } from "@/lib/services/procurement/list-purchase-orders";
import { cn } from "@/lib/utils";

const CARD =
  "rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]";

type Labels = Dictionary["procurement"]["ordersList"];

function StatusBadge({ status, labels }: { status: string; labels: Dictionary["status"]["purchaseOrder"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap",
        PURCHASE_ORDER_STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600",
      )}
    >
      {getPurchaseOrderStatusLabel(labels, status)}
    </span>
  );
}

/** Missing-data labels for open orders only (the service already sets all flags false for CLOSED/CANCELLED). */
function AttentionFlags({ order, t }: { order: PurchaseOrderListItem; t: Labels }) {
  const flags = [
    order.needsAttention.missingPrice ? t.flags.missingPrice : null,
    order.needsAttention.missingWarehouse ? t.flags.missingWarehouse : null,
    order.needsAttention.missingExpectedArrival ? t.flags.missingExpectedArrival : null,
  ].filter((flag): flag is string => flag !== null);

  if (flags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((flag) => (
        <span
          key={flag}
          className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap text-amber-700"
        >
          {flag}
        </span>
      ))}
    </div>
  );
}

function itemsSummary(order: PurchaseOrderListItem, locale: Locale, dictionary: Dictionary): string {
  const t = dictionary.procurement.ordersList;
  return `${pluralize(locale, order.itemCount, t.itemsCount)} · ${formatKg(order.totalQuantityKg, locale)} ${dictionary.common.kgUnit}`;
}

/** Complete amount, or an explicit "incomplete" state — never a partial sum. */
function AmountCell({
  order,
  locale,
  t,
  align,
}: {
  order: PurchaseOrderListItem;
  locale: Locale;
  t: Labels;
  align: "left" | "right";
}) {
  if (order.totalAmount !== null) {
    return (
      <span className="font-semibold whitespace-nowrap text-slate-900">
        {formatMoney(order.totalAmount, order.currency, locale)}
      </span>
    );
  }
  return (
    <span className={cn("flex flex-col", align === "right" ? "items-end" : "items-start")}>
      <span className="font-medium whitespace-nowrap text-amber-600">{t.amountIncomplete}</span>
      <span className="text-[11.5px] whitespace-nowrap text-slate-400">
        {t.missingPrices.replace("{count}", String(order.missingPriceCount))}
      </span>
    </span>
  );
}

/**
 * >=1024px: a real <table> with the seven approved columns; <1024px: one
 * card per order linking to its detail page (same split as the Sales
 * OrdersList). All amounts come pre-computed from the service. Two empty
 * states: no purchase orders at all vs. no filter matches.
 */
export function PurchaseOrdersList({
  orders,
  hasAnyOrders,
  canCreate,
  clearFiltersHref,
  locale,
  dictionary,
}: {
  orders: PurchaseOrderListItem[];
  /** False only when the PurchaseOrder table itself is empty. */
  hasAnyOrders: boolean;
  /** procurement.orders.create — only then is the create CTA shown in the empty state. */
  canCreate: boolean;
  clearFiltersHref: string;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const t = dictionary.procurement.ordersList;
  const statusLabels = dictionary.status.purchaseOrder;

  if (orders.length === 0) {
    return (
      <div className={cn(CARD, "flex flex-col items-center justify-center gap-2 px-4 py-12 text-center")}>
        {hasAnyOrders ? (
          <>
            <SearchX className="h-5 w-5 text-slate-300" strokeWidth={1.75} />
            <p className="text-[13px] font-medium text-slate-500">{t.empty.noResults}</p>
            <Link href={clearFiltersHref} className="text-[12.5px] font-medium text-blue-600 hover:text-blue-700">
              {t.empty.clearFilters}
            </Link>
          </>
        ) : (
          <>
            <ClipboardList className="h-5 w-5 text-slate-300" strokeWidth={1.75} />
            <p className="text-[13px] font-medium text-slate-500">{t.empty.noOrdersTitle}</p>
            <p className="max-w-md text-[12.5px] text-slate-400">{t.empty.noOrdersDescription}</p>
            {canCreate ? (
              <Link
                href="/procurement/orders/new"
                className="mt-2 rounded-full bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800"
              >
                {t.createOrder}
              </Link>
            ) : null}
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={cn(CARD, "hidden overflow-hidden lg:block")}>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
              <th scope="col" className="px-4 py-3">
                {t.columns.order}
              </th>
              <th scope="col" className="px-4 py-3">
                {t.columns.supplier}
              </th>
              <th scope="col" className="px-4 py-3">
                {t.columns.status}
              </th>
              <th scope="col" className="px-4 py-3">
                {t.columns.items}
              </th>
              <th scope="col" className="px-4 py-3">
                {t.columns.delivery}
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                {t.columns.amount}
              </th>
              <th scope="col" className="px-4 py-3">
                {t.columns.attention}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr key={order.id} className="align-top text-[13px] transition-colors hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/procurement/orders/${order.id}`}
                    className="rounded-sm font-medium whitespace-nowrap text-slate-900 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none"
                  >
                    {order.orderNumber}
                  </Link>
                  <p className="mt-0.5 text-[11.5px] whitespace-nowrap text-slate-400">
                    {t.createdOn.replace("{date}", formatShortDate(order.createdAt, locale))}
                  </p>
                </td>
                <td className="max-w-[220px] px-4 py-3">
                  <p className="truncate text-slate-700">{order.supplier.name}</p>
                  <p className="truncate text-[11.5px] text-slate-400">{order.supplier.code}</p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} labels={statusLabels} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                  {itemsSummary(order, locale, dictionary)}
                </td>
                <td className="max-w-[180px] px-4 py-3">
                  <p className={cn("truncate", order.destinationWarehouse ? "text-slate-700" : "text-slate-400")}>
                    {order.destinationWarehouse?.name ?? t.noWarehouse}
                  </p>
                  <p className="truncate text-[11.5px] text-slate-400">
                    {order.expectedArrivalDate
                      ? t.expectedBy.replace("{date}", formatShortDate(order.expectedArrivalDate, locale))
                      : t.noExpectedArrival}
                  </p>
                </td>
                <td className="px-4 py-3 text-right">
                  <AmountCell order={order} locale={locale} t={t} align="right" />
                </td>
                <td className="px-4 py-3">
                  <AttentionFlags order={order} t={t} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 lg:hidden">
        {orders.map((order) => {
          const delivery = [
            order.destinationWarehouse?.name ?? t.noWarehouse,
            order.expectedArrivalDate
              ? t.expectedBy.replace("{date}", formatShortDate(order.expectedArrivalDate, locale))
              : t.noExpectedArrival,
          ].join(" · ");

          return (
            <li key={order.id}>
              <Link
                href={`/procurement/orders/${order.id}`}
                className={cn(
                  CARD,
                  "block p-3.5 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold text-slate-900">{order.orderNumber}</span>
                  <StatusBadge status={order.status} labels={statusLabels} />
                </div>
                <p className="mt-1 truncate text-[12.5px] text-slate-600">{order.supplier.name}</p>
                <p className="mt-1.5 truncate text-[11.5px] text-slate-500">{itemsSummary(order, locale, dictionary)}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-slate-400">{delivery}</p>
                <div className="mt-2 text-[13px]">
                  <AmountCell order={order} locale={locale} t={t} align="left" />
                </div>
                {order.needsAttention.missingPrice ||
                order.needsAttention.missingWarehouse ||
                order.needsAttention.missingExpectedArrival ? (
                  <div className="mt-2">
                    <AttentionFlags order={order} t={t} />
                  </div>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
