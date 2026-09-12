import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type OperationsCardProps = {
  title: string;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Same border/radius/shadow/typography language as AnalyticsCard, kept as a
 * sibling primitive (matching the existing KPI-card / analytics-card split)
 * rather than a cross-section import, with its own height budget (250-290px).
 */
export function OperationsCard({ title, badge, action, children, className }: OperationsCardProps) {
  return (
    <div
      className={cn(
        "flex h-auto flex-col rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06)] min-[768px]:max-[1439px]:h-[268px] min-[1440px]:h-[254px]",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[13.5px] font-semibold tracking-tight text-slate-900">{title}</h3>
          {badge}
        </div>
        {action}
      </div>
      <div className="mt-2 flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
