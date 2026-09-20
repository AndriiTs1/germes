import { ChevronRight } from "lucide-react";

import { OperationsCard } from "@/components/dashboard/operations/operations-card";
import { getAttentionItems } from "@/lib/services/dashboard/get-attention-items";
import type { AttentionAccent, AttentionItem } from "@/components/dashboard/operations/operations-data";
import { CircleAlert, ClipboardCheck, Truck } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { pluralize } from "@/lib/i18n/pluralize";
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

/** item.value for money/kg kinds; a genuinely pluralized "{count} orders" (never a frozen string) for kind: "ordersAwaitingShipment". */
function itemValue(item: AttentionItem, locale: Locale, t: Dictionary["commandCenter"]["needsAttention"]): string {
  if (item.count !== undefined) {
    return pluralize(locale, item.count, t.ordersCount);
  }
  return item.value ?? "";
}

export async function NeedsAttention({
  className,
  locale,
  dictionary,
}: {
  className?: string;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const t = dictionary.commandCenter.needsAttention;
  const attentionData = await getAttentionItems();

  const needsAttention: AttentionItem[] = attentionData.map((item) => ({
    ...item,
    icon:
      item.kind === "overdueCustomerPayments"
        ? CircleAlert
        : item.kind === "supplierInvoiceAwaitingApproval"
          ? ClipboardCheck
          : Truck,
    accent:
      item.kind === "overdueCustomerPayments"
        ? "rose"
        : item.kind === "supplierInvoiceAwaitingApproval"
          ? "violet"
          : "blue",
  }));

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
              {/*
                line-clamp-2 at every breakpoint (no desktop-only
                line-clamp-1/truncate override) — the previous desktop
                override was cutting full localized labels ("Счёт
                поставщика ожидает утвержде…") even though this span
                already has min-w-0 flex-1 to receive the row's remaining
                width correctly. Two lines max, matching the mobile
                behavior that was already correct.
              */}
              <span className="line-clamp-2 min-w-0 flex-1 text-[12.5px] font-medium text-slate-700">
                {itemLabel(item, t)}
              </span>
              <span className="shrink-0 text-[12.5px] font-semibold text-slate-900">
                {itemValue(item, locale, t)}
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" strokeWidth={1.75} />
            </button>
          </li>
        ))}
      </ul>
    </OperationsCard>
  );
}
