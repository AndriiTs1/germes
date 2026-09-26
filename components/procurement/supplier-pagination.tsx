import Link from "next/link";

import { buildSupplierListHref, type SupplierListQuery } from "@/components/procurement/supplier-list-url";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

const LINK =
  "rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50";
const DISABLED = "rounded-full border border-slate-200/70 px-3 py-1.5 text-[12.5px] font-medium text-slate-300";

/** Same layout as the Sales list pagination; hidden when there is only one page. Keeps active filters. */
export function SupplierPagination({
  page,
  pageCount,
  query,
  dictionary,
}: {
  page: number;
  pageCount: number;
  query: Omit<SupplierListQuery, "page">;
  dictionary: Dictionary;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label={dictionary.procurement.suppliers.paginationAriaLabel}
      className="flex items-center justify-between pt-1"
    >
      <p className="text-[12px] text-slate-400">
        {dictionary.pagination.page} {page} {dictionary.pagination.of} {pageCount}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={buildSupplierListHref({ ...query, page: page - 1 })} className={LINK}>
            {dictionary.pagination.previous}
          </Link>
        ) : (
          <span aria-hidden="true" className={DISABLED}>
            {dictionary.pagination.previous}
          </span>
        )}
        {page < pageCount ? (
          <Link href={buildSupplierListHref({ ...query, page: page + 1 })} className={LINK}>
            {dictionary.pagination.next}
          </Link>
        ) : (
          <span aria-hidden="true" className={DISABLED}>
            {dictionary.pagination.next}
          </span>
        )}
      </div>
    </nav>
  );
}
