import { KpiCard, KpiRow } from "@/components/dashboard/kpi-card";
import { formatMoney } from "@/components/sales/format";
import { kpiData } from "@/components/dashboard/kpi-data";
import { getCommandCenterKpis } from "@/lib/services/dashboard/get-command-center-kpis";
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

  const items = kpiData.map((kpi) => {
    const valueMap = {
      cashBanks: commandCenterKpis.cashBanks.value,
      receivables: commandCenterKpis.receivables.total,
      overdueAr: commandCenterKpis.overdueReceivables.total,
      payables: commandCenterKpis.payables.total,
      inventoryValue: commandCenterKpis.inventoryValue.value,
      grossMargin: commandCenterKpis.grossMargin.percent + "%",
    };

    return {
      ...kpi,
      value:
        kpi.id === "grossMargin"
          ? `${commandCenterKpis.grossMargin.percent}%`
          : formatMoney(
              valueMap[kpi.id],
              commandCenterKpis.salesTurnover.currency,
              locale,
            ),
      unit: undefined,
      label: t[kpi.id],
      comparisonLabel: t.comparisonLabel,
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
