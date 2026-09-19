"use client";

import { DetailSection } from "@/components/sales/detail-section";
import { ReceivablePaymentForm } from "@/components/sales/receivable-payment-form";
import { formatMoney, formatShortDate } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { SalesOrderDetailReceivable } from "@/lib/services/sales/get-sales-order-detail";

/**
 * Read-only. dueDate/status are only ever present when count === 1 (the
 * service never picks one arbitrarily out of several) — with count > 1,
 * only the safe aggregated totals plus a count are shown.
 *
 * receivable.status is rendered as-is, never localized — FinanceStatus has
 * no dictionary label map (see the i18n audit: localizing Finance status
 * would be speculative work this stage explicitly excludes).
 */
export function OrderDetailReceivable({
  receivable,
  locale,
  dictionary,
  orderId,
  canUpdate,
  className,
}: {
  receivable: SalesOrderDetailReceivable;
  locale: Locale;
  dictionary: Dictionary;
  orderId: string;
  canUpdate: boolean;
  className?: string;
}) {
  const t = dictionary.orderDetail.receivable;

  return (
    <DetailSection title={t.title} className={className}>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
            {t.total}
          </p>
          <p className="mt-0.5 truncate text-[13.5px] font-semibold text-slate-900">
            {formatMoney(receivable.totalAmount, receivable.currency, locale)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
            {t.paid}
          </p>
          <p className="mt-0.5 truncate text-[13.5px] font-semibold text-slate-900">
            {formatMoney(receivable.totalPaid, receivable.currency, locale)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
            {t.outstanding}
          </p>
          <p className="mt-0.5 truncate text-[13.5px] font-semibold text-slate-900">
            {formatMoney(receivable.totalOutstanding, receivable.currency, locale)}
          </p>
        </div>
      </div>

      {receivable.count === 1 ? (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-[12px]">
          <span className="text-slate-500">
            {receivable.dueDate
              ? `${dictionary.common.dueLabel} ${formatShortDate(receivable.dueDate, locale)}`
              : dictionary.common.noDueDate}
          </span>
          <span className="font-medium text-slate-700">{receivable.status}</span>
        </div>
      ) : receivable.count > 1 ? (
        <p className="mt-3 border-t border-slate-100 pt-3 text-[12px] text-slate-400">
          {receivable.count} {t.countSuffix}
        </p>
      ) : null}

      {canUpdate &&
      receivable.count === 1 &&
      receivable.id &&
      Number(receivable.totalOutstanding) > 0 ? (
        <ReceivablePaymentForm
          orderId={orderId}
          receivableId={receivable.id}
          outstandingAmount={receivable.totalOutstanding}
          currency={receivable.currency}
          dictionary={t}
        />
      ) : null}
    </DetailSection>
  );
}
