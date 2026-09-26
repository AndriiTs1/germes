import Link from "next/link";
import { Search } from "lucide-react";

import { SupplierCountrySelect } from "@/components/procurement/supplier-country-select";
import {
  buildSupplierListHref,
  SUPPLIER_STATUSES,
  type SupplierStatusFilter,
} from "@/components/procurement/supplier-list-url";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { SUPPLIER_COUNTRY_NONE } from "@/lib/services/procurement/list-suppliers";
import { cn } from "@/lib/utils";

const PILL = "rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors";
const PILL_ACTIVE = "bg-slate-900 text-white";
const PILL_IDLE = "border border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50";

/**
 * Server-rendered, URL-driven filters for the supplier section, same
 * pattern as the Sales list filters. Row 1: status chips (small fixed
 * enum, plain links). Row 2: one country select (scales with the data)
 * on the left, supplier search (native GET form) on the right. Any filter
 * or search change lands on page 1 and keeps the other active filters.
 */
export function SupplierFilters({
  q,
  status,
  country,
  countries,
  dictionary,
}: {
  q: string;
  status: SupplierStatusFilter;
  country: string;
  /** Distinct stored country values, already sorted for display. */
  countries: string[];
  dictionary: Dictionary;
}) {
  const t = dictionary.procurement.suppliers;

  const statusTabs: { value: SupplierStatusFilter; label: string }[] = [
    { value: "all", label: t.filters.all },
    ...SUPPLIER_STATUSES.map((value) => ({ value, label: t.filters[value] })),
  ];

  const countryOptions = [
    { value: "", label: t.filters.countryAll },
    ...countries.map((value) => ({ value, label: value })),
    { value: SUPPLIER_COUNTRY_NONE, label: t.filters.countryNone },
  ];

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label={t.filters.statusAriaLabel} className="flex flex-wrap gap-1.5">
        {statusTabs.map((tab) => {
          const isActive = tab.value === status;
          return (
            <Link
              key={tab.value}
              href={buildSupplierListHref({ q, status: tab.value, country })}
              aria-current={isActive ? "page" : undefined}
              className={cn(PILL, isActive ? PILL_ACTIVE : PILL_IDLE)}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SupplierCountrySelect
          q={q}
          status={status}
          country={country}
          options={countryOptions}
          ariaLabel={t.filters.countryAriaLabel}
        />

        <form method="GET" action="/procurement" className="w-full sm:w-72">
          {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
          {country ? <input type="hidden" name="country" value={country} /> : null}
          <label htmlFor="suppliers-search" className="sr-only">
            {t.search.ariaLabel}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              strokeWidth={1.75}
            />
            <input
              id="suppliers-search"
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
    </div>
  );
}
