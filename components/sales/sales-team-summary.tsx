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

/** One full line per currency, never summed across currencies; ["0"] when there is nothing. */
function moneyLines(rows: { currency: string; value: string }[], locale: Locale): string[] {
  if (rows.length === 0) return ["0"];
  return rows.map((row) => formatMoney(row.value, row.currency, locale));
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
  // Counts are a single value; money is one line per currency.
  const rows: { label: string; value: string | string[]; tone?: "rose" | "amber" }[] = [
    { label: labels.metrics.customers, value: String(metrics.customerCount) },
    { label: labels.metrics.activeOrders, value: String(metrics.activeOrderCount) },
    {
      label: labels.metrics.attention,
      value: String(metrics.attentionCount),
      tone: metrics.attentionCount > 0 ? "amber" : undefined,
    },
    {
      label: labels.metrics.turnover,
      value: moneyLines(
        metrics.turnover.map((row) => ({ currency: row.currency, value: row.amount })),
        locale,
      ),
    },
    {
      label: labels.metrics.receivables,
      value: moneyLines(
        metrics.receivables.map((row) => ({ currency: row.currency, value: row.totalOutstanding })),
        locale,
      ),
    },
    {
      label: labels.metrics.overdue,
      value: moneyLines(
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
              "text-[13px] font-semibold text-slate-900",
              // Money lines are never truncated: Intl group separators are
              // non-breaking, so a narrow card can only wrap before the currency code.
              Array.isArray(row.value) ? "flex flex-col leading-snug" : "truncate",
              row.tone === "rose" && "text-rose-600",
              row.tone === "amber" && "text-amber-600",
            )}
          >
            {Array.isArray(row.value) ? row.value.map((line) => <span key={line}>{line}</span>) : row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One company-wide figure. Money comes as one line per currency — each line
 * shown in full; on a very narrow card it can only wrap before the currency
 * code (Intl group separators are non-breaking), never truncated.
 */
function CompanyCard({
  label,
  lines,
  money = false,
  tone,
}: {
  label: string;
  lines: string[];
  /** Money uses a slightly smaller size so a full amount fits a 4-column card. */
  money?: boolean;
  tone?: "rose";
}) {
  return (
    <div className={cn(CARD_CLASS, "min-w-0 px-5")}>
      <p className="text-[13px] leading-[1.25] font-medium text-slate-500">{label}</p>
      <div
        className={cn(
          "mt-2.5 flex flex-col gap-1 font-semibold tracking-tight text-slate-900",
          money ? "text-[19px] leading-tight" : "text-[22px] leading-none",
          tone === "rose" && "text-rose-600",
        )}
      >
        {lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
    </div>
  );
}

/**
 * Company-wide portfolio figures, as separate cards. Active orders and needs
 * attention are deliberately not repeated here — the KPI row above already
 * shows the same company-wide numbers.
 */
function CompanySummary({
  metrics,
  labels,
  locale,
}: {
  metrics: SalesTeamMetrics;
  labels: Labels;
  locale: Locale;
}) {
  const overdue = metrics.receivables.filter((row) => row.overdueOutstanding !== "0");

  return (
    // 4 columns from 1440px (90rem — rem, so Tailwind orders it after md:; a px
    // arbitrary breakpoint is emitted before md: and silently loses to it).
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 min-[90rem]:grid-cols-4 xl:gap-3.5">
      <CompanyCard label={labels.metrics.customers} lines={[String(metrics.customerCount)]} />
      <CompanyCard
        label={labels.metrics.turnover}
        money
        lines={moneyLines(metrics.turnover.map((row) => ({ currency: row.currency, value: row.amount })), locale)}
      />
      <CompanyCard
        label={labels.metrics.receivables}
        money
        lines={moneyLines(
          metrics.receivables.map((row) => ({ currency: row.currency, value: row.totalOutstanding })),
          locale,
        )}
      />
      <CompanyCard
        label={labels.metrics.overdue}
        money
        lines={moneyLines(overdue.map((row) => ({ currency: row.currency, value: row.overdueOutstanding })), locale)}
        tone={overdue.length > 0 ? "rose" : undefined}
      />
    </div>
  );
}

/**
 * Supervisory ("all" read scope) team block for /sales: the company-wide
 * total ("Company total" section) and one card per sales manager ("Sales
 * team" section). Presentation only — receives the
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

  // Two sibling sections, each titled like "Operational details" below
  // (same heading style and heading-to-content gap), so every block's
  // heading sits directly over its own cards.
  return (
    <>
      <section className="flex flex-col gap-3 xl:gap-2.5">
        <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{labels.companyTotal}</h2>
        <CompanySummary metrics={summary.total} labels={labels} locale={locale} />
      </section>

      <section className="flex flex-col gap-3 xl:gap-2.5">
        <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{labels.title}</h2>
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
                {/* mt-auto: pinned to the card bottom, so every card in a row has its link on one line; pt-3 keeps the former gap. */}
                <span className="mt-auto flex items-center gap-0.5 pt-3 text-[12px] font-medium text-blue-600 group-hover:text-blue-700">
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
    </>
  );
}
