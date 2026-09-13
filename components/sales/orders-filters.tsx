import Link from "next/link";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

export type OrdersStatusFilter = "all" | "active" | "completed" | "cancelled";

type OrdersFiltersProps = {
  q: string;
  status: OrdersStatusFilter;
};

const STATUS_TABS: { value: OrdersStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function buildFilterHref(status: OrdersStatusFilter, q: string): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/sales/orders?${qs}` : "/sales/orders";
}

/**
 * Fully server-rendered, URL-driven filters — no client state, no context.
 * Status tabs are plain links; search is a native GET <form> that
 * navigates to ?q=... itself. Prisma does the actual filtering (see
 * listSalesOrders) — this component only reflects/builds URLs.
 */
export function OrdersFilters({ q, status }: OrdersFiltersProps) {
  return (
    <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
      <nav aria-label="Filter orders by status" className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => {
          const isActive = tab.value === status;
          return (
            <Link
              key={tab.value}
              href={buildFilterHref(tab.value, q)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                isActive
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <form method="GET" className="flex items-center gap-2">
        {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
        <label htmlFor="orders-search" className="sr-only">
          Search orders by order number or customer
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            strokeWidth={1.75}
          />
          <input
            id="orders-search"
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search order # or customer..."
            className="h-9 w-full min-w-[200px] rounded-full border border-slate-200/70 bg-slate-100/70 pr-3 pl-9 text-[13px] text-slate-700 placeholder:text-slate-400 transition-colors focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
          />
        </div>
      </form>
    </div>
  );
}
