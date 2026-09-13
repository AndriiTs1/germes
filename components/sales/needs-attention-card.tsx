import { AlertCircle, PackageCheck } from "lucide-react";

import { OperationsCard } from "@/components/dashboard/operations/operations-card";
import type {
  AttentionCustomer,
  AttentionReasonType,
} from "@/lib/services/sales/get-attention-customers";

const reasonLabels: Record<AttentionReasonType, string> = {
  NEXT_ACTION_OVERDUE: "Next action overdue",
  STALE_CONTACT: "No contact in 21+ days",
  STALE_PURCHASE: "No purchase in 45+ days",
};

export function NeedsAttentionCard({
  customers,
  className,
}: {
  customers: AttentionCustomer[];
  className?: string;
}) {
  return (
    <OperationsCard
      title="Needs Attention"
      className={className}
      badge={
        customers.length > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-50 px-1.5 text-[11px] font-semibold text-rose-600">
            {customers.length}
          </span>
        ) : undefined
      }
    >
      {customers.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-6 text-center">
          <PackageCheck className="h-5 w-5 text-emerald-500" strokeWidth={1.75} />
          <p className="text-[12.5px] font-medium text-slate-500">
            All caught up — no customers need attention
          </p>
        </div>
      ) : (
        <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {customers.map((customer) => (
            <li key={customer.customerId}>
              <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-rose-50 text-rose-600">
                  <AlertCircle className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-slate-900">
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
