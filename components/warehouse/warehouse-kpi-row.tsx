import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type WarehouseKpiAccent = "blue" | "amber" | "violet" | "emerald";

const accentChipStyles: Record<WarehouseKpiAccent, string> = {
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  emerald: "bg-emerald-50 text-emerald-600",
};

export type WarehouseKpiCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  accent: WarehouseKpiAccent;
};

/**
 * Same visual language as SalesKpiRow/SalesKpiCard (border/radius/shadow/
 * typography, desktop grid + mobile compact-rows-in-one-card pattern) but
 * kept as its own small WAREHOUSE-scoped component rather than reusing the
 * SALES one directly, so the two domains stay decoupled. Every Warehouse
 * KPI here is a plain queue count, so there is no unit/warning row.
 */
function WarehouseKpiCard({ label, value, icon: Icon, accent }: WarehouseKpiCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
            accentChipStyles[accent],
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <p className="line-clamp-2 pt-1 text-[13px] leading-[1.25] font-medium text-slate-500">
          {label}
        </p>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[22px] leading-none font-semibold whitespace-nowrap tracking-tight text-slate-900">
          {value}
        </span>
      </div>
    </div>
  );
}

function WarehouseKpiRow({ label, value, icon: Icon, accent }: WarehouseKpiCardProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
          accentChipStyles[accent],
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>

      <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-500">{label}</p>

      <span className="shrink-0 text-[22px] leading-none font-semibold whitespace-nowrap tracking-tight text-slate-900">
        {value}
      </span>
    </div>
  );
}

/**
 * Desktop/tablet grid (>=768px) plus the mobile compact-rows-in-one-card
 * pattern already established by SalesKpiSummary/Owner's DashboardKpis —
 * same responsive technique, WAREHOUSE-specific data.
 */
export function WarehouseKpiSummary({ items }: { items: WarehouseKpiCardProps[] }) {
  if (items.length === 0) return null;

  return (
    <>
      <div className="hidden gap-3 md:grid md:max-[1279px]:grid-cols-2 min-[1280px]:grid-cols-4">
        {items.map((item) => (
          <WarehouseKpiCard key={item.label} {...item} />
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)] md:hidden">
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.label}>
              <WarehouseKpiRow {...item} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
