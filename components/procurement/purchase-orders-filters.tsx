import Link from "next/link";
import { Search } from "lucide-react";

import {
  buildPurchaseOrderListHref,
  PURCHASE_ORDER_STATUSES,
  type PurchaseOrderStatusFilter,
} from "@/components/procurement/purchase-order-list-url";
import { getPurchaseOrderStatusLabel } from "@/components/procurement/purchase-order-status";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

const PILL = "rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors";
const PILL_ACTIVE = "bg-slate-900 text-white";
const PILL_IDLE = "border border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50";

/**
 * Server-rendered, URL-driven filters (same pattern as SupplierFilters and
 * the Sales list): status pills are plain links using the exact
 * PurchaseOrderStatus values, search is a native GET form. Any change
 * lands on page 1 and keeps the other filter.
 */
export function PurchaseOrdersFilters({
  q,
  status,
  dictionary,
}: {
  q: string;
  status: PurchaseOrderStatusFilter;
  dictionary: Dictionary;
}) {
  const t = dictionary.procurement.ordersList;

  const statusTabs: { value: PurchaseOrderStatusFilter; label: string }[] = [
    { value: "all", label: t.filters.all },
    ...PURCHASE_ORDER_STATUSES.map((value) => ({
      value,
      label: getPurchaseOrderStatusLabel(dictionary.status.purchaseOrder, value),
    })),
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <nav aria-label={t.filters.ariaLabel} className="flex flex-wrap gap-1.5">
        {statusTabs.map((tab) => {
          const isActive = tab.value === status;
          return (
            <Link
              key={tab.value}
              href={buildPurchaseOrderListHref({ q, status: tab.value })}
              aria-current={isActive ? "page" : undefined}
              className={cn(PILL, isActive ? PILL_ACTIVE : PILL_IDLE)}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <form method="GET" action="/procurement/orders" className="w-full sm:w-72">
        {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
        <label htmlFor="purchase-orders-search" className="sr-only">
          {t.search.ariaLabel}
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            strokeWidth={1.75}
          />
          <input
            id="purchase-orders-search"
            type="search"
            name="q"
            defaultValue={q}
            autoComplete="off"
            placeholder={t.search.placeholder}
            className="h-10 w-full rounded-full border border-slate-200/70 bg-slate-100/70 pr-3 pl-9 text-base text-slate-700 placeholder:text-slate-400 transition-colors focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:outline-none sm:h-9 md:text-[13px]"
          />
        </div>
      </form>
    </div>
  );
}
