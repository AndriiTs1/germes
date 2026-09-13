import Link from "next/link";

import type { CustomersStatusFilter } from "@/components/sales/customers-filters";

type CustomersPaginationProps = {
  page: number;
  pageCount: number;
  q: string;
  status: CustomersStatusFilter;
};

function buildPageHref(page: number, status: CustomersStatusFilter, q: string): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (q) params.set("q", q);
  params.set("page", String(page));
  return `/sales/customers?${params.toString()}`;
}

/** Hidden entirely when there's only one page — same rule as OrdersPagination. */
export function CustomersPagination({ page, pageCount, q, status }: CustomersPaginationProps) {
  if (pageCount <= 1) return null;

  const hasPrevious = page > 1;
  const hasNext = page < pageCount;

  return (
    <nav aria-label="Customers pagination" className="flex items-center justify-between pt-1">
      <p className="text-[12px] text-slate-400">
        Page {page} of {pageCount}
      </p>
      <div className="flex items-center gap-2">
        {hasPrevious ? (
          <Link
            href={buildPageHref(page - 1, status, q)}
            className="rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Previous
          </Link>
        ) : (
          <span
            aria-hidden="true"
            className="rounded-full border border-slate-200/70 px-3 py-1.5 text-[12.5px] font-medium text-slate-300"
          >
            Previous
          </span>
        )}
        {hasNext ? (
          <Link
            href={buildPageHref(page + 1, status, q)}
            className="rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Next
          </Link>
        ) : (
          <span
            aria-hidden="true"
            className="rounded-full border border-slate-200/70 px-3 py-1.5 text-[12.5px] font-medium text-slate-300"
          >
            Next
          </span>
        )}
      </div>
    </nav>
  );
}
