import Link from "next/link";
import { Search } from "lucide-react";

import { ProductCategorySelect } from "@/components/products/product-category-select";
import {
  buildProductListHref,
  PRODUCT_LIST_BASE_PATH,
  PRODUCT_STATUS_FILTERS,
  type ProductStatusFilter,
} from "@/components/products/product-list-url";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

const PILL = "rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors";
const PILL_ACTIVE = "bg-slate-900 text-white";
const PILL_IDLE = "border border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50";

/**
 * Server-rendered, URL-driven filters for the product catalog — same layout
 * as the supplier directory filters, but kept as one compact, left-aligned
 * group instead of being pushed to opposite page edges. Row 1: status chips
 * with the result count right after them (secondary text; wraps under the
 * chips on narrow phones). Row 2: category select + SKU/name search side by
 * side from 640px, stacked full-width below. Any change lands on page 1 and
 * keeps the other filters.
 */
export function ProductFilters({
  q,
  status,
  category,
  categories,
  resultCount,
  dictionary,
}: {
  q: string;
  status: ProductStatusFilter;
  category: string;
  /** Distinct stored category values, already sorted for display. */
  categories: string[];
  resultCount: string;
  dictionary: Dictionary;
}) {
  const t = dictionary.products;

  const categoryOptions = [
    { value: "", label: t.filters.categoryAll },
    ...categories.map((value) => ({ value, label: value })),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <nav aria-label={t.filters.statusAriaLabel} className="flex flex-wrap gap-1.5">
          {PRODUCT_STATUS_FILTERS.map((value) => {
            const isActive = value === status;
            return (
              <Link
                key={value}
                href={buildProductListHref({ q, status: value, category })}
                aria-current={isActive ? "page" : undefined}
                className={cn(PILL, isActive ? PILL_ACTIVE : PILL_IDLE)}
              >
                {t.filters[value]}
              </Link>
            );
          })}
        </nav>

        <p className="text-[12.5px] whitespace-nowrap text-slate-500">{resultCount}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <ProductCategorySelect
          q={q}
          status={status}
          category={category}
          options={categoryOptions}
          ariaLabel={t.filters.categoryAriaLabel}
        />

        <form method="GET" action={PRODUCT_LIST_BASE_PATH} className="w-full sm:w-72 lg:w-80">
          {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
          {category ? <input type="hidden" name="category" value={category} /> : null}
          <label htmlFor="products-search" className="sr-only">
            {t.search.ariaLabel}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              strokeWidth={1.75}
            />
            <input
              id="products-search"
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
