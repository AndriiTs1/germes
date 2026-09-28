import { Wallet } from "lucide-react";
import type { ReactNode } from "react";

import { OperationsCard } from "@/components/dashboard/operations/operations-card";
import { formatMoney } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ReceivableExposureByCurrency } from "@/lib/services/sales/get-receivable-exposure";

/** `action`: optional header link (e.g. to /finance), decided by the caller. */
export function ReceivablesCard({
  receivables,
  locale,
  dictionary,
  className,
  action,
}: {
  receivables: ReceivableExposureByCurrency[];
  locale: Locale;
  dictionary: Dictionary;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <OperationsCard title={dictionary.sales.receivablesCard.title} className={className} action={action}>
      {receivables.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-6 text-center">
          <Wallet className="h-5 w-5 text-slate-300 xl:h-4 xl:w-4" strokeWidth={1.75} />
          <p className="text-[12.5px] font-medium text-slate-500 xl:text-[12px]">
            {dictionary.sales.receivablesCard.empty}
          </p>
        </div>
      ) : (
        <ul className="flex flex-1 flex-col gap-2.5 overflow-y-auto xl:gap-2">
          {receivables.map((bucket) => (
            <li key={bucket.currency} className="rounded-xl bg-slate-50/70 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold tracking-[0.04em] text-slate-500 uppercase">
                  {bucket.currency}
                </span>
                <span className="truncate text-[13px] font-semibold text-slate-900 xl:text-[14px] xl:font-bold">
                  {formatMoney(bucket.totalOutstanding, bucket.currency, locale)}
                </span>
              </div>
              {/* Wraps instead of truncating: both amounts always stay readable in full. */}
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px]">
                <span className="font-medium text-rose-600">
                  {dictionary.sales.receivablesCard.overdueLabel}{" "}
                  {formatMoney(bucket.overdueOutstanding, bucket.currency, locale)}
                </span>
                <span className="font-medium text-amber-600">
                  {dictionary.sales.receivablesCard.dueSoonLabel}{" "}
                  {formatMoney(bucket.dueSoonOutstanding, bucket.currency, locale)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </OperationsCard>
  );
}
