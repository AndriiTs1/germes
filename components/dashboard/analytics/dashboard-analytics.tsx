import { InventoryStatus } from "@/components/dashboard/analytics/inventory-status";
import { ProcurementNeeds } from "@/components/dashboard/analytics/procurement-needs";
import { SalesPerformance } from "@/components/dashboard/analytics/sales-performance";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

/**
 * The Cash Flow card is intentionally not rendered (so getCashFlow is not
 * queried): until real payment/cash transactions exist it could only show
 * a synthetic line with a hardcoded period — see get-cash-flow.ts.
 * Three cards: 768–1439px two columns with the last card spanning the row,
 * >=1440px one row with the same 7:6:6 proportions as before.
 */
export function DashboardAnalytics({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  return (
    <div className="grid grid-cols-1 gap-4 min-[768px]:max-[1439px]:grid-cols-2 min-[768px]:max-[1439px]:[&>*:last-child]:col-span-2 min-[1440px]:grid-cols-[7fr_6fr_6fr]">
      <SalesPerformance locale={locale} dictionary={dictionary} />
      <InventoryStatus dictionary={dictionary} />
      <ProcurementNeeds dictionary={dictionary} />
    </div>
  );
}
