import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AnalyticsCardProps = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Shared shell for the primary analytics row. Same radius/border/typography
 * language as the KPI cards, with a slightly deeper shadow to signal these
 * cards carry richer information.
 */
export function AnalyticsCard({ title, action, children, className }: AnalyticsCardProps) {
  return (
    <div
      className={cn(
        "flex h-[210px] flex-col rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06)]",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between">
        <h3 className="text-[13.5px] font-semibold tracking-tight text-slate-900">{title}</h3>
        {action}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
