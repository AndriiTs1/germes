import { Fragment } from "react";
import { Wallet } from "lucide-react";

import { FinanceReceivablePaymentForm } from "@/components/finance/receivable-payment-form";
import { formatMoney, formatShortDate } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { FinanceReceivableListItem } from "@/lib/services/finance/list-receivables";
import { cn } from "@/lib/utils";

type Props = {
  receivables: FinanceReceivableListItem[];
  locale: Locale;
  dictionary: Dictionary;
  canUpdateReceivables: boolean;
};

function StatusBadge({
  receivable,
  dictionary,
}: {
  receivable: FinanceReceivableListItem;
  dictionary: Dictionary;
}) {
  const t = dictionary.finance.receivables;

  const label = receivable.isOverdue
    ? t.status.overdue
    : t.status[receivable.status.toLowerCase() as keyof typeof t.status] ??
      receivable.status;

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap",
        receivable.isOverdue
          ? "bg-rose-50 text-rose-700"
          : receivable.status === "PAID"
            ? "bg-emerald-50 text-emerald-700"
            : receivable.status === "PARTIALLY_PAID"
              ? "bg-amber-50 text-amber-700"
              : receivable.status === "CANCELLED"
                ? "bg-slate-100 text-slate-500"
                : "bg-blue-50 text-blue-700",
      )}
    >
      {label}
    </span>
  );
}

export function FinanceReceivablesList({
  receivables,
  locale,
  dictionary,
  canUpdateReceivables,
}: Props) {
  const t = dictionary.finance.receivables;

  if (receivables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200/70 bg-white px-4 py-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]">
        <Wallet className="h-5 w-5 text-slate-300" strokeWidth={1.75} />
        <p className="text-[13px] font-medium text-slate-500">{t.empty}</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)] lg:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
              <th className="px-4 py-3">{t.customer}</th>
              <th className="px-4 py-3">{t.order}</th>
              <th className="px-4 py-3">{t.statusLabel}</th>
              <th className="px-4 py-3">{t.dueDate}</th>
              <th className="px-4 py-3 text-right">{t.amount}</th>
              <th className="px-4 py-3 text-right">{t.paid}</th>
              <th className="px-4 py-3 text-right">{t.outstanding}</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {receivables.map((receivable) => {
              const canRegisterPayment =
                canUpdateReceivables &&
                receivable.status !== "PAID" &&
                receivable.status !== "CANCELLED" &&
                Number(receivable.outstandingAmount) > 0;

              return (
                <Fragment key={receivable.id}>
                  <tr
                    className="text-[13px] transition-colors hover:bg-slate-50"
                  >
                    <td className="max-w-[220px] truncate px-4 py-3 font-medium text-slate-900">
                      {receivable.customerName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {receivable.orderNumber ?? receivable.reference ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge receivable={receivable} dictionary={dictionary} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                      {receivable.dueDate
                        ? formatShortDate(receivable.dueDate, locale)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-slate-700">
                      {formatMoney(receivable.amount, receivable.currency, locale)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-slate-700">
                      {formatMoney(receivable.paidAmount, receivable.currency, locale)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-slate-900">
                      {formatMoney(
                        receivable.outstandingAmount,
                        receivable.currency,
                        locale,
                      )}
                    </td>
                  </tr>

                  {canRegisterPayment ? (
                    <tr>
                      <td colSpan={7} className="px-4 pb-4">
                        <FinanceReceivablePaymentForm
                          receivableId={receivable.id}
                          outstandingAmount={receivable.outstandingAmount}
                          currency={receivable.currency}
                          orderLabel={
                            receivable.orderNumber ?? receivable.reference ?? "—"
                          }
                          dictionary={t}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 lg:hidden">
        {receivables.map((receivable) => (
          <li
            key={receivable.id}
            className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-slate-900">
                  {receivable.customerName}
                </p>
                <p className="mt-0.5 text-[11.5px] text-slate-400">
                  {receivable.orderNumber ?? receivable.reference ?? "—"}
                </p>
              </div>
              <StatusBadge receivable={receivable} dictionary={dictionary} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11.5px]">
              <div>
                <p className="text-slate-400">{t.amount}</p>
                <p className="mt-0.5 font-medium text-slate-700">
                  {formatMoney(receivable.amount, receivable.currency, locale)}
                </p>
              </div>
              <div>
                <p className="text-slate-400">{t.paid}</p>
                <p className="mt-0.5 font-medium text-slate-700">
                  {formatMoney(receivable.paidAmount, receivable.currency, locale)}
                </p>
              </div>
              <div>
                <p className="text-slate-400">{t.dueDate}</p>
                <p className="mt-0.5 font-medium text-slate-700">
                  {receivable.dueDate ? formatShortDate(receivable.dueDate, locale) : "—"}
                </p>
              </div>
              <div>
                <p className="text-slate-400">{t.outstanding}</p>
                <p className="mt-0.5 font-semibold text-slate-900">
                  {formatMoney(receivable.outstandingAmount, receivable.currency, locale)}
                </p>
              </div>
            </div>

            {canUpdateReceivables &&
            receivable.status !== "PAID" &&
            receivable.status !== "CANCELLED" &&
            Number(receivable.outstandingAmount) > 0 ? (
              <FinanceReceivablePaymentForm
                receivableId={receivable.id}
                outstandingAmount={receivable.outstandingAmount}
                currency={receivable.currency}
                orderLabel={
                  receivable.orderNumber ?? receivable.reference ?? "—"
                }
                dictionary={t}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
