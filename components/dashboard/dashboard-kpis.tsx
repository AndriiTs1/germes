import { KpiCard, KpiRow } from "@/components/dashboard/kpi-card";
import { kpiData } from "@/components/dashboard/kpi-data";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

export function DashboardKpis({ dictionary }: { dictionary: Dictionary }) {
  const t = dictionary.commandCenter.kpi;
  const items = kpiData.map((kpi) => ({
    ...kpi,
    label: t[kpi.id],
    comparisonLabel: t.comparisonLabel,
  }));

  return (
    <>
      {/* >=768px: unchanged tile grid */}
      <div className="hidden grid-cols-1 gap-3 min-[380px]:max-[1023px]:grid-cols-2 min-[1024px]:max-[1439px]:grid-cols-3 min-[1440px]:grid-cols-6 md:grid">
        {items.map((kpi) => (
          <KpiCard key={kpi.id} {...kpi} />
        ))}
      </div>

      {/* <768px: one summary card with all 6 KPIs as compact rows */}
      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)] md:hidden">
        <ul className="divide-y divide-slate-100">
          {items.map((kpi) => (
            <li key={kpi.id}>
              <KpiRow {...kpi} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
