import { formatMoney } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type {
  FinanceOwnerOverview,
} from "@/lib/services/finance/get-finance-owner-overview";

type Amount = {
  currency: string;
  amount: string;
};

function currencyPriority(currency: string): number {
  if (currency === "UAH") return 0;
  if (currency === "EUR") return 1;
  return 2;
}

function orderedAmounts(amounts: Amount[]): Amount[] {
  return [...amounts].sort(
    (a, b) =>
      currencyPriority(a.currency) -
        currencyPriority(b.currency) ||
      a.currency.localeCompare(b.currency),
  );
}

function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return Object.entries(values).reduce(
    (result, [key, value]) =>
      result.replace(`{${key}}`, String(value)),
    template,
  );
}

function signedMoney(
  amount: string,
  currency: string,
  locale: Locale,
) {
  const negative = amount.startsWith("-");
  const raw = negative ? amount.slice(1) : amount;
  const positive = !negative && raw !== "0";

  return {
    text: `${negative ? "−" : positive ? "+" : ""} ${formatMoney(
      raw,
      currency,
      locale,
    )}`.trim(),
    positive,
    negative,
  };
}

function FinanceMetricCard({
  label,
  amounts,
  meta,
  locale,
  danger = false,
}: {
  label: string;
  amounts: Amount[];
  meta: string;
  locale: Locale;
  danger?: boolean;
}) {
  const values = orderedAmounts(amounts);

  return (
    <div className="flex min-h-[158px] flex-col rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_-24px_rgba(15,23,42,0.22)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] font-semibold tracking-[-0.01em] text-slate-500">
          {label}
        </p>

        {danger ? (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
        ) : null}
      </div>

      <div className="mt-4">
        {values.length === 0 ? (
          <p className="text-[25px] leading-none font-semibold tabular-nums tracking-[-0.035em] text-slate-950">
            0
          </p>
        ) : (
          values.map(({ amount, currency }, index) => (
            <p
              key={currency}
              className={
                index === 0
                  ? "text-[25px] leading-none font-semibold tabular-nums tracking-[-0.035em] text-slate-950"
                  : "mt-2 text-[14px] leading-none font-semibold tabular-nums tracking-[-0.02em] text-slate-600"
              }
            >
              {formatMoney(amount, currency, locale)}
            </p>
          ))
        )}
      </div>

      <div className="mt-auto flex min-h-[44px] items-center border-t border-slate-100">
        <p
          className={
            danger
              ? "text-[11px] font-medium text-rose-600"
              : "text-[11px] font-medium text-slate-500"
          }
        >
          {meta}
        </p>
      </div>
    </div>
  );
}

function MobileMetricRow({
  label,
  amounts,
  meta,
  locale,
  danger = false,
}: {
  label: string;
  amounts: Amount[];
  meta: string;
  locale: Locale;
  danger?: boolean;
}) {
  const values = orderedAmounts(amounts);

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          {danger ? (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
          ) : null}

          <p className="text-[12px] font-semibold text-slate-500">
            {label}
          </p>
        </div>

        <div className="shrink-0 text-right">
          {values.length === 0 ? (
            <p className="text-[17px] font-semibold tabular-nums text-slate-950">
              0
            </p>
          ) : (
            values.map(({ amount, currency }, index) => (
              <p
                key={currency}
                className={
                  index === 0
                    ? "text-[17px] leading-tight font-semibold whitespace-nowrap tabular-nums tracking-[-0.025em] text-slate-950"
                    : "mt-0.5 text-[11.5px] leading-tight font-semibold whitespace-nowrap tabular-nums text-slate-500"
                }
              >
                {formatMoney(amount, currency, locale)}
              </p>
            ))
          )}
        </div>
      </div>

      <p
        className={
          danger
            ? "mt-1.5 text-[10.5px] font-medium text-rose-600"
            : "mt-1.5 text-[10.5px] font-medium text-slate-400"
        }
      >
        {meta}
      </p>
    </div>
  );
}

function DesktopCashPlan({
  overview,
  locale,
  dictionary,
}: {
  overview: FinanceOwnerOverview;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const t = dictionary.finance.ownerOverview;

  const inflows = orderedAmounts(
    overview.receivables.dueNext7Days,
  );

  const outflows = orderedAmounts(
    overview.payables.dueNext7Days,
  );

  const net = orderedAmounts(
    overview.cashPlan.netNext7Days,
  );

  return (
    <div className="flex min-h-[158px] flex-col rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_-24px_rgba(15,23,42,0.22)]">
      <p className="text-[12.5px] font-semibold text-slate-500">
        {t.kpi.horizon}
      </p>

      <div className="mt-2.5">
        <div className="flex items-start justify-between gap-4 pb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span className="text-[10.5px] font-medium text-slate-400">
                {t.cashPlan.inflow}
              </span>
            </div>

            <p className="mt-0.5 pl-3 text-[9.5px] text-slate-400">
              {overview.receivables.dueNext7DaysCount}{" "}
              {t.cashPlan.itemsShort}
            </p>
          </div>

          <div className="shrink-0 text-right">
            {inflows.length === 0 ? (
              <p className="text-[15px] font-semibold tabular-nums text-slate-950">
                0
              </p>
            ) : (
              inflows.map(({ amount, currency }, index) => (
                <p
                  key={currency}
                  className={
                    index === 0
                      ? "text-[15px] leading-tight font-semibold whitespace-nowrap tabular-nums tracking-[-0.02em] text-emerald-700"
                      : "mt-0.5 text-[10.5px] leading-tight font-semibold whitespace-nowrap tabular-nums text-slate-500"
                  }
                >
                  + {formatMoney(amount, currency, locale)}
                </p>
              ))
            )}
          </div>
        </div>

        <div className="flex items-start justify-between gap-4 border-t border-slate-100 pt-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              <span className="text-[10.5px] font-medium text-slate-400">
                {t.cashPlan.outflow}
              </span>
            </div>

            <p className="mt-0.5 pl-3 text-[9.5px] text-slate-400">
              {overview.payables.dueNext7DaysCount}{" "}
              {t.cashPlan.itemsShort}
            </p>
          </div>

          <div className="shrink-0 text-right">
            {outflows.length === 0 ? (
              <p className="text-[15px] font-semibold tabular-nums text-slate-950">
                0
              </p>
            ) : (
              outflows.map(({ amount, currency }, index) => (
                <p
                  key={currency}
                  className={
                    index === 0
                      ? "text-[15px] leading-tight font-semibold whitespace-nowrap tabular-nums tracking-[-0.02em] text-slate-950"
                      : "mt-0.5 text-[10.5px] leading-tight font-semibold whitespace-nowrap tabular-nums text-slate-500"
                  }
                >
                  − {formatMoney(amount, currency, locale)}
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto flex min-h-[44px] items-center justify-between gap-4 border-t border-slate-100">
        <span className="text-[10.5px] font-medium text-slate-400">
          {t.cashPlan.net}
        </span>

        <div className="shrink-0 text-right">
          {net.length === 0 ? (
            <p className="text-[11.5px] font-semibold text-slate-500">
              0
            </p>
          ) : (
            net.map(({ amount, currency }) => {
              const formatted = signedMoney(
                amount,
                currency,
                locale,
              );

              return (
                <p
                  key={currency}
                  className={
                    formatted.negative
                      ? "text-[11.5px] font-semibold whitespace-nowrap tabular-nums text-rose-600"
                      : "text-[11.5px] font-semibold whitespace-nowrap tabular-nums text-emerald-700"
                  }
                >
                  {formatted.text}
                </p>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function MobileCashPlan({
  overview,
  locale,
  dictionary,
}: {
  overview: FinanceOwnerOverview;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const t = dictionary.finance.ownerOverview;

  const inflows = orderedAmounts(
    overview.receivables.dueNext7Days,
  );

  const outflows = orderedAmounts(
    overview.payables.dueNext7Days,
  );

  const net = orderedAmounts(
    overview.cashPlan.netNext7Days,
  );

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-slate-500">
          {t.kpi.horizon}
        </p>

        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
          7D
        </span>
      </div>

      <div className="mt-3 divide-y divide-slate-100">
        <div className="flex items-start justify-between gap-3 pb-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10.5px] font-medium text-slate-400">
                {t.cashPlan.inflow}
              </span>
            </div>

            <p className="mt-1 text-[10px] text-slate-400">
              {overview.receivables.dueNext7DaysCount}{" "}
              {t.cashPlan.itemsShort}
            </p>
          </div>

          <div className="text-right">
            {inflows.map(({ amount, currency }, index) => (
              <p
                key={currency}
                className={
                  index === 0
                    ? "text-[16px] leading-tight font-semibold whitespace-nowrap tabular-nums text-emerald-700"
                    : "mt-0.5 text-[11px] font-semibold whitespace-nowrap tabular-nums text-slate-500"
                }
              >
                + {formatMoney(amount, currency, locale)}
              </p>
            ))}
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 py-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span className="text-[10.5px] font-medium text-slate-400">
                {t.cashPlan.outflow}
              </span>
            </div>

            <p className="mt-1 text-[10px] text-slate-400">
              {overview.payables.dueNext7DaysCount}{" "}
              {t.cashPlan.itemsShort}
            </p>
          </div>

          <div className="text-right">
            {outflows.map(({ amount, currency }) => (
              <p
                key={currency}
                className="text-[15px] leading-tight font-semibold whitespace-nowrap tabular-nums text-slate-950"
              >
                − {formatMoney(amount, currency, locale)}
              </p>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-3">
          <span className="text-[10.5px] font-medium text-slate-400">
            {t.cashPlan.net}
          </span>

          <div className="text-right">
            {net.map(({ amount, currency }) => {
              const formatted = signedMoney(
                amount,
                currency,
                locale,
              );

              return (
                <p
                  key={currency}
                  className={
                    formatted.negative
                      ? "text-[11.5px] font-semibold whitespace-nowrap tabular-nums text-rose-600"
                      : "text-[11.5px] font-semibold whitespace-nowrap tabular-nums text-emerald-700"
                  }
                >
                  {formatted.text}
                </p>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FinanceOwnerKpis({
  overview,
  locale,
  dictionary,
}: {
  overview: FinanceOwnerOverview;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const t = dictionary.finance.ownerOverview;

  const receivablesMeta = interpolate(
    t.summary.receivablesContext,
    {
      positions: overview.receivables.openCount,
      customers:
        overview.receivables.customersWithDebt,
    },
  );

  const overdueMeta = interpolate(
    t.summary.overdueReceivablesRatio,
    {
      overdue: overview.receivables.overdueCount,
      total: overview.receivables.openCount,
    },
  );

  const payablesMeta = interpolate(
    t.summary.overduePayablesRatio,
    {
      overdue: overview.payables.overdueCount,
      total: overview.payables.openCount,
    },
  );

  return (
    <>
      {/* Mobile: one compact financial summary instead of three tall cards. */}
      <div className="space-y-3 md:hidden">
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <MobileMetricRow
            label={t.kpi.receivables}
            amounts={overview.receivables.outstanding}
            meta={receivablesMeta}
            locale={locale}
          />

          <MobileMetricRow
            label={t.kpi.overdue}
            amounts={overview.receivables.overdue}
            meta={overdueMeta}
            locale={locale}
            danger
          />

          <MobileMetricRow
            label={t.kpi.payables}
            amounts={overview.payables.outstanding}
            meta={payablesMeta}
            locale={locale}
            danger={overview.payables.overdueCount > 0}
          />
        </div>

        <MobileCashPlan
          overview={overview}
          locale={locale}
          dictionary={dictionary}
        />
      </div>

      {/* Desktop/tablet: preserve the current four-card layout. */}
      <div className="hidden grid-cols-2 gap-3 md:grid min-[1280px]:grid-cols-[1fr_1fr_1fr_1.15fr]">
        <FinanceMetricCard
          label={t.kpi.receivables}
          amounts={overview.receivables.outstanding}
          locale={locale}
          meta={receivablesMeta}
        />

        <FinanceMetricCard
          label={t.kpi.overdue}
          amounts={overview.receivables.overdue}
          locale={locale}
          danger
          meta={overdueMeta}
        />

        <FinanceMetricCard
          label={t.kpi.payables}
          amounts={overview.payables.outstanding}
          locale={locale}
          danger={overview.payables.overdueCount > 0}
          meta={payablesMeta}
        />

        <DesktopCashPlan
          overview={overview}
          locale={locale}
          dictionary={dictionary}
        />
      </div>
    </>
  );
}
