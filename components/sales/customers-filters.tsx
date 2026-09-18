import Link from "next/link";
import { Search } from "lucide-react";

import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

export type CustomersStatusFilter = "all" | "ACTIVE" | "POTENTIAL" | "INACTIVE" | "BLOCKED";

type CustomersFiltersProps = {
  q: string;
  status: CustomersStatusFilter;
  dictionary: Dictionary;
};

function buildFilterHref(status: CustomersStatusFilter, q: string): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/sales/customers?${qs}` : "/sales/customers";
}

/**
 * Same fully server-rendered, URL-driven pattern as OrdersFilters — no
 * client state, no context. Status tabs use the exact CustomerStatus enum
 * values, no invented grouping (unlike Orders' "Active" bucket, every
 * CustomerStatus value is already a standalone meaningful state). Query
 * parameter VALUES are never localized — only the tab's rendered label is.
 */
export function CustomersFilters({ q, status, dictionary }: CustomersFiltersProps) {
  const statusTabs: { value: CustomersStatusFilter; label: string }[] = [
    { value: "all", label: dictionary.customers.filters.all },
    { value: "ACTIVE", label: dictionary.customers.filters.active },
    { value: "POTENTIAL", label: dictionary.customers.filters.potential },
    { value: "INACTIVE", label: dictionary.customers.filters.inactive },
    { value: "BLOCKED", label: dictionary.customers.filters.blocked },
  ];

  return (
    <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
      <nav aria-label={dictionary.customers.filters.ariaLabel} className="flex flex-wrap gap-1.5">
        {statusTabs.map((tab) => {
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

      {/*
        w-full min-[640px]:w-auto / flex-1 min-[640px]:flex-none: same fix
        as orders-filters.tsx — below 640px a flex item's default width is
        shrink-to-fit, and the input's own width:100% can't expand a
        shrink-to-fit parent, so the search box was rendering at its
        min-w-[200px] floor regardless of viewport and clipping long RU/UK
        placeholders. >=640px restores the exact previous compact,
        right-docked width.
      */}
      <form method="GET" className="flex w-full items-center gap-2 min-[640px]:w-auto">
        {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
        <label htmlFor="customers-search" className="sr-only">
          {dictionary.customers.search.ariaLabel}
        </label>
        <div className="relative flex-1 min-[640px]:flex-none">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            strokeWidth={1.75}
          />
          <input
            id="customers-search"
            type="text"
            name="q"
            defaultValue={q}
            // autoComplete="off": same reasoning as orders-filters.tsx —
            // no real suggestion feature exists on this field, so the
            // browser's own uncontrollable saved-values popup is
            // suppressed rather than left to render at an inconsistent
            // native width/position.
            autoComplete="off"
            placeholder={dictionary.customers.search.placeholder}
            // text-base md:text-[13px] (not a fixed text-[13px]): a real
            // text-entry control — iOS Safari auto-zooms the visual
            // viewport when a focused input's computed font-size is below
            // 16px, same fix already applied to orders-filters.tsx.
            className="h-9 w-full min-w-[200px] rounded-full border border-slate-200/70 bg-slate-100/70 pr-3 pl-9 text-base text-slate-700 placeholder:text-slate-400 transition-colors focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:outline-none md:text-[13px]"
          />
        </div>
      </form>
    </div>
  );
}
