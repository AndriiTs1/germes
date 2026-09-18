import { ChevronRight } from "lucide-react";

import { OperationsCard } from "@/components/dashboard/operations/operations-card";
import { needsAttention } from "@/components/dashboard/operations/operations-data";
import type { AttentionAccent, AttentionItem } from "@/components/dashboard/operations/operations-data";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

const accentStyles: Record<AttentionAccent, string> = {
  rose: "bg-rose-50 text-rose-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  blue: "bg-blue-50 text-blue-600",
};

/** "Low stock:" (localized) + the untouched demo product name for kind: "lowStock"; every other kind resolves directly from the dictionary. */
function itemLabel(item: AttentionItem, t: Dictionary["commandCenter"]["needsAttention"]): string {
  if (item.kind === "lowStock") {
    return `${t.lowStockPrefix} ${item.productName}`;
  }
  return t[item.kind];
}

export function NeedsAttention({ className, dictionary }: { className?: string; dictionary: Dictionary }) {
  const t = dictionary.commandCenter.needsAttention;

  return (
    <OperationsCard
      title={t.title}
      className={className}
      badge={
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-50 px-1.5 text-[11px] font-semibold text-rose-600">
          {needsAttention.length}
        </span>
      }
    >
      <ul className="flex flex-1 flex-col gap-0.5 min-[768px]:justify-between min-[768px]:gap-0">
        {needsAttention.map((item) => (
          <li key={item.kind}>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-2 py-1 text-left transition-colors hover:bg-slate-50"
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px]",
                  accentStyles[item.accent],
                )}
              >
                <item.icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="line-clamp-2 min-w-0 flex-1 text-[12.5px] font-medium text-slate-700 min-[768px]:line-clamp-1 min-[768px]:truncate">
                {itemLabel(item, t)}
              </span>
              <span className="shrink-0 text-[12.5px] font-semibold text-slate-900">{item.value}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" strokeWidth={1.75} />
            </button>
          </li>
        ))}
      </ul>
    </OperationsCard>
  );
}
