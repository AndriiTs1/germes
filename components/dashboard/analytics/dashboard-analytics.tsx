import { CashFlow } from "@/components/dashboard/analytics/cash-flow";
import { InventoryStatus } from "@/components/dashboard/analytics/inventory-status";
import { ProcurementNeeds } from "@/components/dashboard/analytics/procurement-needs";
import { SalesPerformance } from "@/components/dashboard/analytics/sales-performance";

export function DashboardAnalytics() {
  return (
    <div className="grid grid-cols-1 gap-4 min-[768px]:max-[1439px]:grid-cols-2 min-[1440px]:grid-cols-[7fr_6fr_6fr_6fr]">
      <SalesPerformance />
      <CashFlow />
      <InventoryStatus />
      <ProcurementNeeds />
    </div>
  );
}
