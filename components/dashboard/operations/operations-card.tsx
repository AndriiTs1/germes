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
 *
 * min-h- rather than a hard h- (Stage: desktop polish): the CSS grid rows
 * this renders in (SalesWorkspace's min-[1024px]:grid-cols-[5fr_7fr] and
 * min-[1024px]:grid-cols-3) already stretch every item to the tallest
 * sibling by default, so a floor height still keeps every card in a row
 * visually equal-height while never silently clipping a card whose content
 * genuinely needs more room. The desktop shadow is very slightly deeper
 * than the base one (mobile/tablet keep the original), for a touch more
 * depth without becoming heavy.
 */
export function OperationsCard({ title, badge, action, children, className }: OperationsCardProps) {
  return (
    <div
      className={cn(
        "flex h-auto flex-col rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06)] min-[768px]:max-[1439px]:min-h-[268px] min-[1440px]:min-h-[254px] xl:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_28px_-12px_rgba(15,23,42,0.12)]",
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
      <div className="mt-2 flex flex-1 flex-col overflow-hidden xl:mt-2.5">{children}</div>
    </div>
  );
}
