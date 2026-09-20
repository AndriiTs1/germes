import { Beef, Drumstick, type LucideIcon } from "lucide-react";

import { AnalyticsCard } from "@/components/dashboard/analytics/analytics-card";
import { getProcurementNeeds } from "@/lib/services/dashboard/get-procurement-needs";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

/** Keyed by the exact (untranslated) demo product name — never localized, see the Command Center audit. */
const productIcons: Record<string, LucideIcon> = {
  "Chicken Fillet": Drumstick,
  "Pork Neck": Beef,
  "Beef Trim 80/20": Beef,
  "Філе куряче заморожене": Drumstick,
  "Ошийок свинячий": Beef,
  "Яловичина Trim 80/20": Beef,
};

export async function ProcurementNeeds({ dictionary }: { dictionary: Dictionary }) {
  const { value, items } = await getProcurementNeeds();
  const t = dictionary.commandCenter.procurementNeeds;

  return (
    <AnalyticsCard title={t.title}>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[22px] leading-none font-semibold tracking-tight text-slate-900">
          {value}
        </span>
      </div>
      <p className="mt-1 text-[11.5px] text-slate-400">{t.itemsToReorder}</p>

      <ul className="mt-auto space-y-0.5">
        {items.map((item) => {
          const isCritical = item.urgency === "critical";
          const Icon = productIcons[item.name] ?? Beef;
          return (
            <li key={item.name}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-xl px-1.5 py-0.5 text-left transition-colors hover:bg-slate-50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px]",
                      isCritical ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-[12.5px] leading-tight font-medium text-slate-900">
                      {item.name}
                    </span>
                    <span className="block text-[11px] leading-tight text-slate-400">
                      {t.stockLabel} {item.stockKg} {dictionary.common.kgUnit}
                    </span>
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    isCritical ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600",
                  )}
                >
                  {isCritical ? t.critical : t.warning}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </AnalyticsCard>
  );
}
