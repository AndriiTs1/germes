import { DashboardAnalytics } from "@/components/dashboard/analytics/dashboard-analytics";
import { DashboardKpis } from "@/components/dashboard/dashboard-kpis";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardOperations } from "@/components/dashboard/operations/dashboard-operations";
import { PeriodControl } from "@/components/dashboard/period-control";

export default function Home() {
  return (
    <DashboardShell>
      <div className="pb-4">
        <h1 className="text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
          Command Center
        </h1>

        {/* Header hides the period control below md; it lives here instead. */}
        <div className="mt-4 md:hidden">
          <PeriodControl />
        </div>
      </div>

      <DashboardKpis />

      <div className="mt-4">
        <DashboardAnalytics />
      </div>

      <div className="mt-4">
        <DashboardOperations />
      </div>

      {/* Step 5+: Team Performance. */}
    </DashboardShell>
  );
}
