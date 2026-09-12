import { Calendar, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export function PeriodControl({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200/70 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50",
        className,
      )}
    >
      <Calendar className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
      This month
      <ChevronDown className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
    </button>
  );
}
