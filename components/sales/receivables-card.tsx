import { Wallet } from "lucide-react";

import { OperationsCard } from "@/components/dashboard/operations/operations-card";
import { formatMoney } from "@/components/sales/format";
import type { ReceivableExposureByCurrency } from "@/lib/services/sales/get-receivable-exposure";

export function ReceivablesCard({
  receivables,
  className,
}: {
  receivables: ReceivableExposureByCurrency[];
  className?: string;
}) {
  return (
    <OperationsCard title="Receivables" className={className}>
      {receivables.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-6 text-center">
          <Wallet className="h-5 w-5 text-slate-300" strokeWidth={1.75} />
          <p className="text-[12.5px] font-medium text-slate-500">No outstanding receivables</p>
        </div>
      ) : (
        <ul className="flex flex-1 flex-col gap-2.5 overflow-y-auto">
          {receivables.map((bucket) => (
            <li key={bucket.currency} className="rounded-xl bg-slate-50/70 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold tracking-[0.04em] text-slate-500 uppercase">
                  {bucket.currency}
                </span>
                <span className="truncate text-[13px] font-semibold text-slate-900">
                  {formatMoney(bucket.totalOutstanding, bucket.currency)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate font-medium text-rose-600">
                  Overdue {formatMoney(bucket.overdueOutstanding, bucket.currency)}
                </span>
                <span className="truncate font-medium text-amber-600">
                  Due soon {formatMoney(bucket.dueSoonOutstanding, bucket.currency)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </OperationsCard>
  );
}
