import { KpiCard } from "@/components/dashboard/kpi-card";
import { kpiData } from "@/components/dashboard/kpi-data";

export function DashboardKpis() {
  return (
    <div className="grid grid-cols-1 gap-3 min-[380px]:max-[1023px]:grid-cols-2 min-[1024px]:max-[1439px]:grid-cols-3 min-[1440px]:grid-cols-6">
      {kpiData.map((kpi) => (
        <KpiCard key={kpi.id} {...kpi} />
      ))}
    </div>
  );
}
