import Link from "next/link";

import type { OrdersStatusFilter } from "@/components/sales/orders-filters";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type OrdersPaginationProps = {
  page: number;
  pageCount: number;
  q: string;
  status: OrdersStatusFilter;
  dictionary: Dictionary;
};

function buildPageHref(page: number, status: OrdersStatusFilter, q: string): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (q) params.set("q", q);
  params.set("page", String(page));
  return `/sales/orders?${params.toString()}`;
}

/** Hidden entirely when there's only one page — no controls for nothing to page through. */
export function OrdersPagination({ page, pageCount, q, status, dictionary }: OrdersPaginationProps) {
  if (pageCount <= 1) return null;

  const hasPrevious = page > 1;
  const hasNext = page < pageCount;

  return (
    <nav aria-label={dictionary.orders.paginationAriaLabel} className="flex items-center justify-between pt-1">
      <p className="text-[12px] text-slate-400">
        {dictionary.pagination.page} {page} {dictionary.pagination.of} {pageCount}
      </p>
      <div className="flex items-center gap-2">
        {hasPrevious ? (
          <Link
            href={buildPageHref(page - 1, status, q)}
            className="rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            {dictionary.pagination.previous}
          </Link>
        ) : (
          <span
            aria-hidden="true"
            className="rounded-full border border-slate-200/70 px-3 py-1.5 text-[12.5px] font-medium text-slate-300"
          >
            {dictionary.pagination.previous}
          </span>
        )}
        {hasNext ? (
          <Link
            href={buildPageHref(page + 1, status, q)}
            className="rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            {dictionary.pagination.next}
          </Link>
        ) : (
          <span
            aria-hidden="true"
            className="rounded-full border border-slate-200/70 px-3 py-1.5 text-[12.5px] font-medium text-slate-300"
          >
            {dictionary.pagination.next}
          </span>
        )}
      </div>
    </nav>
  );
}
