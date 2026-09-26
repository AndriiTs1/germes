import { ChevronRight, UsersRound } from "lucide-react";
import Link from "next/link";

import { formatMoney } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type {
  SalesTeamMetrics,
  SalesTeamSummary as SalesTeamSummaryData,
} from "@/lib/services/sales/get-sales-team-summary";
import { cn } from "@/lib/utils";

type Labels = Dictionary["sales"]["workspace"]["team"];

const CARD_CLASS =
  "rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06)] xl:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_28px_-12px_rgba(15,23,42,0.12)]";

/** One value per currency, never summed across currencies; "0" when there is nothing. */
function formatPerCurrency(
  rows: { currency: string; value: string }[],
  locale: Locale,
): string {
  if (rows.length === 0) return "0";
  return rows.map((row) => formatMoney(row.value, row.currency, locale)).join(" · ");
}

function hasAnything(metrics: SalesTeamMetrics): boolean {
  return (
    metrics.customerCount > 0 ||
    metrics.activeOrderCount > 0 ||
    metrics.attentionCount > 0 ||
    metrics.turnover.length > 0 ||
    metrics.receivables.length > 0
  );
}

function MetricList({
  metrics,
  labels,
  locale,
  className,
}: {
  metrics: SalesTeamMetrics;
  labels: Labels;
  locale: Locale;
  className?: string;
}) {
  const overdue = metrics.receivables.filter((row) => row.overdueOutstanding !== "0");
  const rows: { label: string; value: string; tone?: "rose" | "amber" }[] = [
    { label: labels.metrics.customers, value: String(metrics.customerCount) },
    { label: labels.metrics.activeOrders, value: String(metrics.activeOrderCount) },
    {
      label: labels.metrics.attention,
      value: String(metrics.attentionCount),
      tone: metrics.attentionCount > 0 ? "amber" : undefined,
    },
    {
      label: labels.metrics.turnover,
      value: formatPerCurrency(
        metrics.turnover.map((row) => ({ currency: row.currency, value: row.amount })),
        locale,
      ),
    },
    {
      label: labels.metrics.receivables,
      value: formatPerCurrency(
        metrics.receivables.map((row) => ({ currency: row.currency, value: row.totalOutstanding })),
        locale,
      ),
    },
    {
      label: labels.metrics.overdue,
      value: formatPerCurrency(
        overdue.map((row) => ({ currency: row.currency, value: row.overdueOutstanding })),
        locale,
      ),
      tone: overdue.length > 0 ? "rose" : undefined,
    },
  ];

  return (
    <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-2", className)}>
      {rows.map((row) => (
        <div key={row.label} className="min-w-0">
          <dt className="truncate text-[11px] font-medium text-slate-400">{row.label}</dt>
          <dd
            className={cn(
              "truncate text-[13px] font-semibold text-slate-900",
              row.tone === "rose" && "text-rose-600",
              row.tone === "amber" && "text-amber-600",
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Supervisory ("all" read scope) team block for /sales: a company-wide
 * total plus one card per sales manager. Presentation only — receives the
 * already-fetched getSalesTeamSummary() result and never queries anything
 * itself. Each manager card links to /sales/customers?manager=<id>; that
 * filter is applied by the customers page (drill-down), not here.
 */
export function SalesTeamSummary({
  summary,
  locale,
  dictionary,
}: {
  summary: SalesTeamSummaryData;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const labels = dictionary.sales.workspace.team;
  const showOutsideTeam = hasAnything(summary.outsideTeam);

  return (
    <section className="flex flex-col gap-3 xl:gap-2.5">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{labels.title}</h2>
        <p className="text-[12px] text-slate-500 xl:text-slate-400">{labels.subtitle}</p>
      </div>

      <div className={CARD_CLASS}>
        <h3 className="text-[13.5px] font-semibold tracking-tight text-slate-900">
          {labels.companyTotal}
        </h3>
        <MetricList
          metrics={summary.total}
          labels={labels}
          locale={locale}
          className="mt-2.5 sm:grid-cols-3 lg:grid-cols-6"
        />
      </div>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:gap-3.5">
        {summary.managers.map(({ manager, ...metrics }) => (
          <li key={manager.id}>
            <Link
              href={`/sales/customers?manager=${encodeURIComponent(manager.id)}`}
              className={cn(
                CARD_CLASS,
                "group flex h-full flex-col transition-colors hover:border-slate-300",
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-blue-50 text-blue-600">
                  <UsersRound className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-[13.5px] font-semibold text-slate-900">
                    {manager.name ?? manager.email}
                  </span>
                </span>
              </div>
              <MetricList metrics={metrics} labels={labels} locale={locale} className="mt-3" />
              <span className="mt-3 flex items-center gap-0.5 text-[12px] font-medium text-blue-600 group-hover:text-blue-700">
                {labels.openCustomers}
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
            </Link>
          </li>
        ))}

        {showOutsideTeam ? (
          <li className={cn(CARD_CLASS, "flex flex-col border-dashed")}>
            <h3 className="text-[13.5px] font-semibold tracking-tight text-slate-900">
              {labels.outsideTeam}
            </h3>
            <p className="text-[11px] text-slate-400">{labels.outsideTeamHint}</p>
            <MetricList metrics={summary.outsideTeam} labels={labels} locale={locale} className="mt-3" />
          </li>
        ) : null}
      </ul>
    </section>
  );
}
