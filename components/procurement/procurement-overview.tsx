import { Building2, PackageOpen, UserCheck } from "lucide-react";
import type { ReactNode } from "react";

import { SalesKpiSummary, type SalesKpiCardProps } from "@/components/sales/sales-kpi-row";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ProcurementOverview as ProcurementOverviewData } from "@/lib/services/procurement/get-procurement-overview";

/**
 * Read-only Procurement Overview. Shows only real Supplier counts (when the
 * caller may read suppliers) and an honest "not connected yet" state for
 * purchasing itself — no purchase orders, goods in transit or payables are
 * invented, since no such purchasing model exists in the schema today.
 * Presentation only: receives already-fetched data, never queries.
 */
export function ProcurementOverview({
  overview,
  dictionary,
  children,
}: {
  overview: ProcurementOverviewData | null;
  dictionary: Dictionary;
  /** Rendered between the KPIs and the "purchasing not connected" note (e.g. the supplier list). */
  children?: ReactNode;
}) {
  const t = dictionary.procurement.workspace;

  const kpis: SalesKpiCardProps[] = overview
    ? [
        { label: t.kpi.suppliers, value: String(overview.supplierCount), icon: Building2, accent: "blue" },
        {
          label: t.kpi.activeSuppliers,
          value: String(overview.activeSupplierCount),
          icon: UserCheck,
          accent: "violet",
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      {kpis.length > 0 ? <SalesKpiSummary items={kpis} /> : null}

      {children}

      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200/70 bg-white px-4 py-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]">
        <PackageOpen className="h-5 w-5 text-slate-300" strokeWidth={1.75} />
        <p className="text-[13px] font-medium text-slate-500">{t.notConnected.title}</p>
        <p className="max-w-md text-[12.5px] text-slate-400">{t.notConnected.description}</p>
      </div>
    </div>
  );
}
