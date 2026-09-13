import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DetailSectionProps = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Auto-height card for Order Detail sections. Deliberately NOT
 * OperationsCard/AnalyticsCard — those are fixed-height widgets tuned for
 * the dashboard summary grid and would risk silently clipping variable-
 * length detail content (the project has hit exactly this class of bug
 * before). Same border/radius/shadow/typography language, no height cap.
 */
export function DetailSection({ title, action, children, className }: DetailSectionProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06)]",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900">{title}</h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
