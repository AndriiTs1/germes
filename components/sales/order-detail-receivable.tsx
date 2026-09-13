import { DetailSection } from "@/components/sales/detail-section";
import { formatMoney, formatShortDate } from "@/components/sales/format";
import type { SalesOrderDetailReceivable } from "@/lib/services/sales/get-sales-order-detail";

/**
 * Read-only. dueDate/status are only ever present when count === 1 (the
 * service never picks one arbitrarily out of several) — with count > 1,
 * only the safe aggregated totals plus a count are shown.
 */
export function OrderDetailReceivable({
  receivable,
  className,
}: {
  receivable: SalesOrderDetailReceivable;
  className?: string;
}) {
  return (
    <DetailSection title="Receivable" className={className}>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
            Total
          </p>
          <p className="mt-0.5 truncate text-[13.5px] font-semibold text-slate-900">
            {formatMoney(receivable.totalAmount, receivable.currency)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
            Paid
          </p>
          <p className="mt-0.5 truncate text-[13.5px] font-semibold text-slate-900">
            {formatMoney(receivable.totalPaid, receivable.currency)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
            Outstanding
          </p>
          <p className="mt-0.5 truncate text-[13.5px] font-semibold text-slate-900">
            {formatMoney(receivable.totalOutstanding, receivable.currency)}
          </p>
        </div>
      </div>

      {receivable.count === 1 ? (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-[12px]">
          <span className="text-slate-500">
            {receivable.dueDate ? `Due ${formatShortDate(receivable.dueDate)}` : "No due date"}
          </span>
          <span className="font-medium text-slate-700">{receivable.status}</span>
        </div>
      ) : receivable.count > 1 ? (
        <p className="mt-3 border-t border-slate-100 pt-3 text-[12px] text-slate-400">
          {receivable.count} receivables
        </p>
      ) : null}
    </DetailSection>
  );
}
