import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { getSupplierStatusLabel, SUPPLIER_STATUS_STYLES } from "@/components/procurement/supplier-status";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { SupplierStatus } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

export type SupplierDetailTab = "overview" | "agreements";

/** Same pill links as the supplier status filter — the project's URL-driven sub-navigation style. */
const PILL = "rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors";
const PILL_ACTIVE = "bg-slate-900 text-white";
const PILL_IDLE = "border border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50";

/**
 * Shared top of every supplier-card page: back link, name + status badge,
 * code · country, and the section tabs. Each tab is its own route, so the
 * active one is decided by the page, not client state. Only sections that
 * exist are listed.
 */
export function SupplierDetailHeader({
  supplier,
  activeTab,
  dictionary,
}: {
  supplier: { id: string; name: string; code: string; country: string | null; status: SupplierStatus };
  activeTab: SupplierDetailTab;
  dictionary: Dictionary;
}) {
  const t = dictionary.procurement.supplierDetail;
  const tabs: { key: SupplierDetailTab; label: string; href: string }[] = [
    { key: "overview", label: t.tabs.overview, href: `/procurement/suppliers/${supplier.id}` },
    { key: "agreements", label: t.tabs.agreements, href: `/procurement/suppliers/${supplier.id}/agreements` },
  ];

  return (
    <div className="pb-4">
      <Link
        href="/procurement/suppliers"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
        {t.backToSuppliers}
      </Link>

      <div className="mt-3 flex min-w-0 items-center gap-3">
        <h1 className="truncate text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
          {supplier.name}
        </h1>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap",
            SUPPLIER_STATUS_STYLES[supplier.status] ?? "bg-slate-100 text-slate-600",
          )}
        >
          {getSupplierStatusLabel(dictionary.status.supplier, supplier.status)}
        </span>
      </div>
      <p className="mt-1 truncate text-[13px] text-slate-500">
        {supplier.country ? `${supplier.code} · ${supplier.country}` : supplier.code}
      </p>

      <nav aria-label={t.tabs.ariaLabel} className="mt-4 flex flex-wrap gap-1.5">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(PILL, isActive ? PILL_ACTIVE : PILL_IDLE)}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
