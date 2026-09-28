import { OperationsCard } from "@/components/dashboard/operations/operations-card";
import { FinanceOwnerKpis } from "@/components/finance/finance-owner-kpis";
import { formatMoney } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type {
  FinanceOwnerOverview as FinanceOwnerOverviewData,
} from "@/lib/services/finance/get-finance-owner-overview";

type Props = {
  overview: FinanceOwnerOverviewData;
  locale: Locale;
  dictionary: Dictionary;
};

export function FinanceOwnerOverview({
  overview,
  locale,
  dictionary,
}: Props) {
  const t = dictionary.finance.ownerOverview;

  const hasAging = overview.aging.some(
    (bucket) => bucket.amounts.length > 0,
  );

  return (
    <>
      <FinanceOwnerKpis
        overview={overview}
        locale={locale}
        dictionary={dictionary}
      />

      <div className="mt-4 grid grid-cols-1 gap-4 min-[1100px]:grid-cols-[1.35fr_1fr]">
        <OperationsCard title={t.topDebtors.title}>
          {overview.topDebtors.length === 0 ? (
            <p className="flex flex-1 items-center justify-center px-2 py-6 text-center text-[12.5px] text-slate-400">
              {t.topDebtors.empty}
            </p>
          ) : (
            <div className="space-y-3">
              {overview.topDebtors.map((group) => (
                <div key={group.currency}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold tracking-wide text-slate-500">
                      {group.currency}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {group.items.map((debtor) => {
                      const overdue =
                        Number(debtor.overdueAmount) > 0;

                      return (
                        <div
                          key={`${debtor.customerId}-${debtor.currency}`}
                          className={`${group.items.indexOf(debtor) >= 3 ? "hidden md:grid" : "grid"} grid-cols-[minmax(0,1fr)_auto] gap-3 py-2 first:pt-0 last:pb-0`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-medium text-slate-900">
                              {debtor.customerName}
                            </p>

                            <p className="mt-0.5 text-[10.5px] text-slate-400">
                              {debtor.receivableCount}{" "}
                              {t.topDebtors.positions}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-[12.5px] font-semibold whitespace-nowrap tabular-nums text-slate-900">
                              {formatMoney(
                                debtor.outstandingAmount,
                                debtor.currency,
                                locale,
                              )}
                            </p>

                            {overdue ? (
                              <p className="mt-0.5 text-[10.5px] font-medium whitespace-nowrap tabular-nums text-rose-600">
                                {t.topDebtors.overdue}:{" "}
                                {formatMoney(
                                  debtor.overdueAmount,
                                  debtor.currency,
                                  locale,
                                )}
                              </p>
                            ) : (
                              <p className="mt-0.5 text-[10.5px] text-slate-400">
                                {t.topDebtors.noOverdue}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </OperationsCard>

        <OperationsCard title={t.aging.title}>
          {!hasAging ? (
            <p className="flex flex-1 items-center justify-center px-2 py-6 text-center text-[12.5px] text-slate-400">
              {t.aging.empty}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {overview.aging.map((bucket) => (
                <div
                  key={bucket.bucket}
                  className={`${bucket.amounts.length === 0 ? "hidden md:flex" : "flex"} min-h-10 items-center justify-between gap-4 py-2 first:pt-0 last:pb-0`}
                >
                  <span className="text-[12px] font-medium text-slate-500">
                    {t.aging.buckets[bucket.bucket]}
                  </span>

                  <div className="text-right">
                    {bucket.amounts.length === 0 ? (
                      <span className="text-[12px] text-slate-300">
                        —
                      </span>
                    ) : (
                      bucket.amounts.map(
                        ({ amount, currency }) => (
                          <p
                            key={currency}
                            className="text-[12.5px] font-semibold whitespace-nowrap tabular-nums text-slate-900"
                          >
                            {formatMoney(
                              amount,
                              currency,
                              locale,
                            )}
                          </p>
                        ),
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </OperationsCard>
      </div>
    </>
  );
}
