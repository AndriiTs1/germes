import { FileText } from "lucide-react";

import { INTL_LOCALE_MAP, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { pluralize } from "@/lib/i18n/pluralize";
import type { SupplierAgreementListItem } from "@/lib/services/procurement/list-supplier-agreements";
import type { SupplierAgreementDisplayStatus } from "@/lib/services/procurement/supplier-agreement-display-status";
import { cn } from "@/lib/utils";

const CARD =
  "rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]";

/** Colors are locale-independent; keys are the derived display statuses. */
const DISPLAY_STATUS_STYLES: Record<SupplierAgreementDisplayStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  UPCOMING: "bg-blue-50 text-blue-600",
  ACTIVE: "bg-emerald-50 text-emerald-600",
  EXPIRED: "bg-amber-50 text-amber-600",
  CLOSED: "bg-slate-100 text-slate-400",
};

type AgreementsDictionary = Dictionary["procurement"]["supplierDetail"]["agreements"];

/** "YYYY-MM-DD" → locale date (01.01.2026 in uk/ru). UTC, so the stored calendar date never shifts. */
function formatDate(value: string, locale: Locale): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(INTL_LOCALE_MAP[locale], {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPeriod(agreement: SupplierAgreementListItem, locale: Locale, t: AgreementsDictionary): string {
  const from = formatDate(agreement.validFrom, locale);
  return agreement.validTo === null
    ? t.periodOpenEnded.replace("{from}", from)
    : t.periodRange.replace("{from}", from).replace("{to}", formatDate(agreement.validTo, locale));
}

/**
 * One compact line from the structured payment fields only; null when they
 * aren't set (paymentTermsNote is never summarized here).
 */
function formatPaymentTerms(agreement: SupplierAgreementListItem, locale: Locale, t: AgreementsDictionary): string | null {
  const { prepaymentPercent, balanceDueDays, balanceDueBasis } = agreement;
  if (prepaymentPercent === null) return null;

  const parts: string[] = [];
  if (prepaymentPercent > 0) {
    parts.push(t.payment.prepayment.replace("{percent}", String(prepaymentPercent)));
  }
  if (prepaymentPercent < 100 && balanceDueDays !== null && balanceDueBasis !== null) {
    const balancePercent = String(100 - prepaymentPercent);
    parts.push(
      balanceDueDays === 0
        ? t.payment.balanceSameDay
            .replace("{percent}", balancePercent)
            .replace("{basis}", t.payment.basisOn[balanceDueBasis])
        : t.payment.balance
            .replace("{percent}", balancePercent)
            .replace("{days}", pluralize(locale, balanceDueDays, t.payment.days))
            .replace("{basis}", t.payment.basisAfter[balanceDueBasis]),
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatIncoterm(agreement: SupplierAgreementListItem): string | null {
  if (agreement.incoterm === null) return null;
  return agreement.incotermPlace ? `${agreement.incoterm} · ${agreement.incotermPlace}` : agreement.incoterm;
}

function StatusBadge({ status, labels }: { status: SupplierAgreementDisplayStatus; labels: Dictionary["status"]["supplierAgreement"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap",
        DISPLAY_STATUS_STYLES[status],
      )}
    >
      {labels[status]}
    </span>
  );
}

function Terms({ payment, incoterm }: { payment: string | null; incoterm: string | null }) {
  if (payment === null && incoterm === null) {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <>
      {payment ? <p className="text-slate-700">{payment}</p> : null}
      {incoterm ? <p className="text-[11.5px] text-slate-400">{incoterm}</p> : null}
    </>
  );
}

/**
 * Read-only list of a supplier's agreements. >=768px: compact table
 * (Договір | Період | Валюта | Умови | Статус); <768px: one card per
 * agreement, same breakpoint as the supplier list. Rows are not links yet —
 * there is no agreement detail page.
 */
export function SupplierAgreementsList({
  agreements,
  locale,
  dictionary,
}: {
  agreements: SupplierAgreementListItem[];
  locale: Locale;
  dictionary: Dictionary;
}) {
  const t = dictionary.procurement.supplierDetail.agreements;
  const statusLabels = dictionary.status.supplierAgreement;

  if (agreements.length === 0) {
    return (
      <div className={cn(CARD, "flex flex-col items-center justify-center gap-2 px-4 py-12 text-center")}>
        <FileText className="h-5 w-5 text-slate-300" strokeWidth={1.75} />
        <p className="text-[13px] font-medium text-slate-500">{t.emptyTitle}</p>
        <p className="max-w-[420px] text-[12.5px] text-slate-400">{t.emptyDescription}</p>
      </div>
    );
  }

  const rows = agreements.map((agreement) => ({
    agreement,
    period: formatPeriod(agreement, locale, t),
    payment: formatPaymentTerms(agreement, locale, t),
    incoterm: formatIncoterm(agreement),
  }));

  return (
    <>
      <div className={cn(CARD, "hidden overflow-hidden md:block")}>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
              <th scope="col" className="px-4 py-3">
                {t.columns.agreement}
              </th>
              <th scope="col" className="px-4 py-3">
                {t.columns.period}
              </th>
              <th scope="col" className="px-4 py-3">
                {t.columns.currency}
              </th>
              <th scope="col" className="px-4 py-3">
                {t.columns.terms}
              </th>
              <th scope="col" className="px-4 py-3">
                {t.columns.status}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ agreement, period, payment, incoterm }) => (
              <tr key={agreement.id} className="align-top text-[13px]">
                <td className="max-w-[220px] px-4 py-3">
                  <p className="truncate font-medium text-slate-900">{agreement.agreementNumber}</p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-700">{period}</td>
                <td className="px-4 py-3 text-slate-700">{agreement.currency}</td>
                <td className="px-4 py-3">
                  <Terms payment={payment} incoterm={incoterm} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={agreement.displayStatus} labels={statusLabels} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map(({ agreement, period, payment, incoterm }) => (
          <li key={agreement.id} className={cn(CARD, "p-3 text-[13px]")}>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-semibold text-slate-900">{agreement.agreementNumber}</span>
              <StatusBadge status={agreement.displayStatus} labels={statusLabels} />
            </div>
            <p className="mt-0.5 text-[11.5px] text-slate-400">
              {period} · {agreement.currency}
            </p>
            <div className="mt-2">
              <Terms payment={payment} incoterm={incoterm} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
