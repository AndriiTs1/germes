import { AlertCircle, PackageCheck } from "lucide-react";

import { OperationsCard } from "@/components/dashboard/operations/operations-card";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type {
  AttentionCustomer,
  AttentionReasonType,
} from "@/lib/services/sales/get-attention-customers";

export function NeedsAttentionCard({
  customers,
  dictionary,
  className,
}: {
  customers: AttentionCustomer[];
  dictionary: Dictionary;
  className?: string;
}) {
  const reasonLabels: Record<AttentionReasonType, string> = {
    NEXT_ACTION_OVERDUE: dictionary.sales.needsAttention.reasons.nextActionOverdue,
    STALE_CONTACT: dictionary.sales.needsAttention.reasons.staleContact,
    STALE_PURCHASE: dictionary.sales.needsAttention.reasons.stalePurchase,
  };

  return (
    <OperationsCard
      title={dictionary.sales.needsAttention.title}
      className={className}
      badge={
        customers.length > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-50 px-1.5 text-[11px] font-semibold text-rose-600 xl:h-[18px] xl:min-w-[18px] xl:px-1 xl:text-[10.5px]">
            {customers.length}
          </span>
        ) : undefined
      }
    >
      {customers.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-6 text-center">
          <PackageCheck className="h-5 w-5 text-emerald-500 xl:h-4 xl:w-4" strokeWidth={1.75} />
          <p className="text-[12.5px] font-medium text-slate-500 xl:text-[12px]">
            {dictionary.sales.needsAttention.empty}
          </p>
        </div>
      ) : (
        <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto xl:divide-y xl:divide-slate-100">
          {customers.map((customer) => (
            <li key={customer.customerId}>
              <div className="flex items-center gap-3 rounded-xl px-2 py-1.5 xl:items-start xl:py-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-rose-50 text-rose-600">
                  <AlertCircle className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-slate-900 xl:text-[13px]">
                    {customer.customerName}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">
                    {customer.reasons.map((reason) => reasonLabels[reason.type]).join(" · ")}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </OperationsCard>
  );
}
