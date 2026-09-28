import { KpiCard, KpiRow } from "@/components/dashboard/kpi-card";
import { formatKg, formatMoney } from "@/components/sales/format";
import { kpiData, type KpiId } from "@/components/dashboard/kpi-data";
import { getCommandCenterKpis } from "@/lib/services/dashboard/get-command-center-kpis";
import type { CurrencyAmount } from "@/lib/services/finance/outstanding";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";

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

  // Every value carries only a currency it actually knows — never the last
  // sales order's currency. Cash is a placeholder and Batch.unitCost has no
  // currency, so those two are shown as plain numbers.
  const valueMap: Record<KpiId, string | string[]> = {
    cashBanks: commandCenterKpis.cashBanks.value,
    receivables: perCurrency(commandCenterKpis.receivables.outstanding),
    overdueAr: perCurrency(commandCenterKpis.receivables.overdueOutstanding),
    payables: perCurrency(commandCenterKpis.payables.outstanding),
    inventoryValue: formatKg(commandCenterKpis.inventoryValue.value, locale),
    grossMargin: `${commandCenterKpis.grossMargin.percent}%`,
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
        >=768px tile grid. 6 columns only activates at >=2000px: at the
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
      */}
      <div className="hidden grid-cols-1 gap-3 min-[380px]:max-[1023px]:grid-cols-2 min-[1024px]:max-[1999px]:grid-cols-3 min-[2000px]:grid-cols-6 md:grid">
        {items.map((kpi) => (
          <KpiCard key={kpi.id} {...kpi} />
        ))}
      </div>

      {/* <768px: one summary card with all 6 KPIs as compact rows */}
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
