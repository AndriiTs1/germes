import { KpiCard, KpiRow, type KpiBreakdown } from "@/components/dashboard/kpi-card";
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

  const count = new Intl.NumberFormat(INTL_LOCALE_MAP[locale]);
  // Active orders split by their real status (same labels as everywhere else
  // in the app) — the parts add up to the headline number.
  const activeOrdersBreakdown: KpiBreakdown = {
    label: t.activeOrdersByStatus,
    items: commandCenterKpis.activeOrders.byStatus.map(({ status, count: statusCount }) => ({
      key: status,
      label: dictionary.status.order[status],
      value: count.format(statusCount),
    })),
  };

  const items = kpiData.map((kpi) => {
    return {
      ...kpi,
      value: valueMap[kpi.id],
      unit: undefined,
      label: t[kpi.id],
      breakdown: kpi.id === "activeOrders" ? activeOrdersBreakdown : undefined,
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

        Five KPIs: in the 2-column range (<1024px) the last card spans both
        columns so the final row is always full (no empty cell). 1024–1999px
        is a 6-track grid: the first three cards take 2 tracks each (thirds,
        same widths as before) and the last two take 3 each, so the second
        row is an even 50 / 50 pair. >=2000px shows all five in one row.
      */}
      <div className="hidden grid-cols-1 gap-3 min-[380px]:max-[1023px]:grid-cols-2 min-[380px]:max-[1023px]:[&>*:last-child]:col-span-2 min-[1024px]:max-[1999px]:grid-cols-6 min-[1024px]:max-[1999px]:[&>*]:col-span-2 min-[1024px]:max-[1999px]:[&>*:nth-last-child(-n+2)]:col-span-3 min-[2000px]:grid-cols-5 md:grid">
        {items.map((kpi) => (
          <KpiCard key={kpi.id} {...kpi} />
        ))}
      </div>

      {/* <768px: each KPI is its own compact card (KpiRow), 8px apart */}
      <div className="md:hidden">
        <ul className="flex flex-col gap-2">
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
