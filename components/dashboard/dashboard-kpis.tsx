import { KpiCard, KpiRow } from "@/components/dashboard/kpi-card";
import { formatMoney } from "@/components/sales/format";
import { kpiData, type KpiId } from "@/components/dashboard/kpi-data";
import { getCommandCenterKpis } from "@/lib/services/dashboard/get-command-center-kpis";
import type { CurrencyAmount } from "@/lib/services/finance/outstanding";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { INTL_LOCALE_MAP, type Locale } from "@/lib/i18n/config";

export async function DashboardKpis({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: Dictionary;
}) {
  const t = dictionary.commandCenter.kpi;
  const commandCenterKpis = await getCommandCenterKpis();

  /** One line per currency, each in its own code; "0" (no invented currency) when there are none. */
  const perCurrency = (amounts: CurrencyAmount[]): string | string[] =>
    amounts.length === 0 ? "0" : amounts.map(({ amount, currency }) => formatMoney(amount, currency, locale));

  // Every value is computed from real records and carries only a currency it
  // actually knows. Not shown at all (no honest source yet): cash & banks,
  // gross margin, inventory value.
  const valueMap: Record<KpiId, string | string[]> = {
    revenue12m: perCurrency(commandCenterKpis.revenue12m),
    receivables: perCurrency(commandCenterKpis.receivables.outstanding),
    overdueAr: perCurrency(commandCenterKpis.receivables.overdueOutstanding),
    payables: perCurrency(commandCenterKpis.payables.outstanding),
    activeOrders: new Intl.NumberFormat(INTL_LOCALE_MAP[locale]).format(commandCenterKpis.activeOrders.count),
  };

  const items = kpiData.map((kpi) => {
    return {
      ...kpi,
      value: valueMap[kpi.id],
      unit: undefined,
      label: t[kpi.id],
      // No trend: there is no real previous-period comparison yet.
    };
  });

  return (
    <>
      {/*
        >=768px tile grid. One single row only activates at >=2000px: at the
        previous >=1440px threshold each card was only ~179px wide, leaving
        ~97px for the label after the icon/gap/padding — well under the
        ~169px a worst-case RU/UK label ("Просроченная дебиторская
        задолженность" / "Прострочена дебіторська заборгованість") needs to
        wrap cleanly into 2 lines, and nowhere near enough for the
        comparison sentence either. 3 columns stays active through 1280 and
        1440 (and 1536/2xl) — verified comfortable (~235-289px label width)
        for the longest supported labels in every current locale. 2000px
        was chosen with margin over the ~169px-per-card-label minimum this
        content needs at 6 columns (~191px at 2000px); confirm against a
        real browser before relying on it in production.

        Five KPIs: in the 2- and 3-column ranges the last card spans two
        columns so the final row is always full (no empty cell); >=2000px
        shows all five in one row.
      */}
      <div className="hidden grid-cols-1 gap-3 min-[380px]:max-[1023px]:grid-cols-2 min-[380px]:max-[1999px]:[&>*:last-child]:col-span-2 min-[1024px]:max-[1999px]:grid-cols-3 min-[2000px]:grid-cols-5 md:grid">
        {items.map((kpi) => (
          <KpiCard key={kpi.id} {...kpi} />
        ))}
      </div>

      {/* <768px: one summary card with all KPIs as compact rows */}
      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)] md:hidden">
        <ul className="divide-y divide-slate-100">
          {items.map((kpi) => (
            <li key={kpi.id}>
              <KpiRow {...kpi} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
