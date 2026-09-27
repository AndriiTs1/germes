import { Building2, SearchX } from "lucide-react";
import Link from "next/link";

import { getSupplierStatusLabel, SUPPLIER_STATUS_STYLES } from "@/components/procurement/supplier-status";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { SupplierListItem } from "@/lib/services/procurement/list-suppliers";
import { cn } from "@/lib/utils";

const CARD =
  "rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]";

function StatusBadge({ status, labels }: { status: string; labels: Dictionary["status"]["supplier"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap",
        SUPPLIER_STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600",
      )}
    >
      {getSupplierStatusLabel(labels, status)}
    </span>
  );
}

/**
 * Read-only supplier list. >=768px: table (Постачальник | Країна | Статус),
 * the whole row opens /procurement/suppliers/[id] — the name cell holds the
 * row's single Link, stretched over the <tr> (no client JS, one tab stop
 * per row). <768px: one card per supplier, the whole card is that Link. Only fields that hold real data are shown —
 * empty contact/responsible/payment-term fields are deliberately omitted.
 * Two distinct empty states: no suppliers at all vs. no filter matches.
 */
export function SupplierList({
  suppliers,
  hasAnySuppliers,
  clearFiltersHref,
  dictionary,
}: {
  suppliers: SupplierListItem[];
  /** False only when the Supplier table itself is empty. */
  hasAnySuppliers: boolean;
  clearFiltersHref: string;
  dictionary: Dictionary;
}) {
  const t = dictionary.procurement.suppliers;
  const statusLabels = dictionary.status.supplier;

  if (suppliers.length === 0) {
    return (
      <div className={cn(CARD, "flex flex-col items-center justify-center gap-2 px-4 py-12 text-center")}>
        {hasAnySuppliers ? (
          <>
            <SearchX className="h-5 w-5 text-slate-300" strokeWidth={1.75} />
            <p className="text-[13px] font-medium text-slate-500">{t.empty.noResults}</p>
            <Link
              href={clearFiltersHref}
              className="text-[12.5px] font-medium text-blue-600 hover:text-blue-700"
            >
              {t.empty.clearFilters}
            </Link>
          </>
        ) : (
          <>
            <Building2 className="h-5 w-5 text-slate-300" strokeWidth={1.75} />
            <p className="text-[13px] font-medium text-slate-500">{t.empty.noSuppliers}</p>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={cn(CARD, "hidden overflow-hidden md:block")}>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
              <th scope="col" className="px-4 py-3">
                {t.table.supplier}
              </th>
              <th scope="col" className="px-4 py-3">
                {t.table.country}
              </th>
              <th scope="col" className="px-4 py-3">
                {t.table.status}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {suppliers.map((supplier) => (
              <tr
                key={supplier.id}
                className="relative cursor-pointer text-[13px] transition-colors focus-within:bg-slate-50 hover:bg-slate-50"
              >
                <td className="max-w-[320px] px-4 py-3">
                  <Link
                    href={`/procurement/suppliers/${supplier.id}`}
                    className="block truncate rounded-sm font-medium text-slate-900 underline-offset-2 after:absolute after:inset-0 hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {supplier.name}
                  </Link>
                  <p className="truncate text-[11.5px] text-slate-400">{supplier.code}</p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {supplier.country ? (
                    <span className="text-slate-700">{supplier.country}</span>
                  ) : (
                    <span className="text-slate-400">{t.table.countryNone}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={supplier.status} labels={statusLabels} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {suppliers.map((supplier) => (
          <li key={supplier.id}>
            <Link
              href={`/procurement/suppliers/${supplier.id}`}
              className={cn(
                CARD,
                "block p-3 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] font-semibold text-slate-900">{supplier.name}</span>
                <StatusBadge status={supplier.status} labels={statusLabels} />
              </div>
              <p className="mt-0.5 truncate text-[11.5px] text-slate-400">
                {supplier.code} · {supplier.country ?? t.table.countryNone}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
