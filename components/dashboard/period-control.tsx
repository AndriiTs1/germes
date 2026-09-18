import { Calendar, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type PeriodControlProps = {
  /** Localized label (e.g. dictionary.commandCenter.periodThisMonth) — this component owns no presentation text itself. */
  label: string;
  className?: string;
};

export function PeriodControl({ label, className }: PeriodControlProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200/70 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50",
        className,
      )}
    >
      <Calendar className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
      {label}
      <ChevronDown className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
    </button>
  );
}
