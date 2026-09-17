import { DetailSection } from "@/components/sales/detail-section";
import { formatMoney, formatShortDate } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type {
  CustomerReceivableSummary,
  SalesCustomerDetailReceivableRow,
} from "@/lib/services/sales/get-sales-customer-detail";

type CustomerDetailReceivableProps = {
  receivables: CustomerReceivableSummary[];
  receivableDetails: SalesCustomerDetailReceivableRow[];
  locale: Locale;
  dictionary: Dictionary;
};

/**
 * Only ever rendered by the page when the current user has
 * finance.receivables.read (checked at the page level, not here). Summary
 * is grouped by currency and never combined into one figure. Individual
 * rows below are a compact read-only list — no payment history, no
 * invented payment state, exactly what getSalesCustomerDetail returns.
 */
export function CustomerDetailReceivable({
  receivables,
  receivableDetails,
  locale,
  dictionary,
}: CustomerDetailReceivableProps) {
  const t = dictionary.customerDetail.receivables;

  if (receivables.length === 0) {
    return (
      <DetailSection title={t.title}>
        <p className="text-[13px] text-slate-400">{t.empty}</p>
      </DetailSection>
    );
  }

  return (
    <DetailSection title={t.title}>
      <div className="flex flex-col gap-2">
        {receivables.map((r) => (
          <div
            key={r.currency}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
          >
            <span className="text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
              {r.currency}
            </span>
            <div className="flex items-center gap-4 text-right">
              <div>
                <p className="text-[10.5px] text-slate-400">{t.outstanding}</p>
                <p className="text-[13.5px] font-semibold text-slate-900">
                  {formatMoney(r.totalOutstanding, r.currency, locale)}
                </p>
              </div>
              <div>
                <p className="text-[10.5px] text-slate-400">{t.overdue}</p>
                <p
                  className={
                    r.overdueOutstanding !== "0"
                      ? "text-[13.5px] font-semibold text-rose-600"
                      : "text-[13.5px] font-semibold text-slate-900"
                  }
                >
                  {formatMoney(r.overdueOutstanding, r.currency, locale)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {receivableDetails.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5 border-t border-slate-100 pt-3">
          {receivableDetails.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 text-[12.5px]"
            >
              <span className="truncate text-slate-500">
                {row.dueDate
                  ? `${dictionary.common.dueLabel} ${formatShortDate(row.dueDate, locale)}`
                  : dictionary.common.noDueDate}
                {row.reference ? ` · ${row.reference}` : ""}
              </span>
              <span className="shrink-0 font-medium text-slate-900">
                {formatMoney(row.outstanding, row.currency, locale)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </DetailSection>
  );
}
