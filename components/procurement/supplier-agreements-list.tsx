import { FileText } from "lucide-react";
import Link from "next/link";

import { SupplierAgreementStatusBadge } from "@/components/procurement/supplier-agreement-status";
import {
  formatAgreementPeriod,
  formatIncoterm,
  formatPaymentTermLines,
  getSupplierAgreementHref,
} from "@/components/procurement/supplier-agreement-format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { SupplierAgreementListItem } from "@/lib/services/procurement/list-supplier-agreements";
import { cn } from "@/lib/utils";

const CARD =
  "rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]";

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
 * (Договір | Період | Валюта | Умови | Статус) — the agreement number holds
 * the row's single Link, stretched over the <tr> (same as the supplier
 * list). <768px: one card per agreement, the whole card is that Link.
 */
export function SupplierAgreementsList({
  supplierId,
  agreements,
  locale,
  dictionary,
}: {
  supplierId: string;
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

  const rows = agreements.map((agreement) => {
    const paymentLines = formatPaymentTermLines(agreement, locale, t);
    return {
      agreement,
      href: getSupplierAgreementHref(supplierId, agreement.id),
      period: formatAgreementPeriod(agreement, locale, t),
      payment: paymentLines.length > 0 ? paymentLines.join(" · ") : null,
      incoterm: formatIncoterm(agreement),
    };
  });

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
            {rows.map(({ agreement, href, period, payment, incoterm }) => (
              <tr
                key={agreement.id}
                className="relative cursor-pointer align-top text-[13px] transition-colors focus-within:bg-slate-50 hover:bg-slate-50"
              >
                <td className="max-w-[220px] px-4 py-3">
                  <Link
                    href={href}
                    className="block truncate rounded-sm font-medium text-slate-900 underline-offset-2 after:absolute after:inset-0 hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {agreement.agreementNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-700">{period}</td>
                <td className="px-4 py-3 text-slate-700">{agreement.currency}</td>
                <td className="px-4 py-3">
                  <Terms payment={payment} incoterm={incoterm} />
                </td>
                <td className="px-4 py-3">
                  <SupplierAgreementStatusBadge status={agreement.displayStatus} labels={statusLabels} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map(({ agreement, href, period, payment, incoterm }) => (
          <li key={agreement.id}>
            <Link
              href={href}
              className={cn(
                CARD,
                "block p-3 text-[13px] transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-semibold text-slate-900">{agreement.agreementNumber}</span>
                <SupplierAgreementStatusBadge status={agreement.displayStatus} labels={statusLabels} />
              </div>
              <p className="mt-0.5 text-[11.5px] text-slate-400">
                {period} · {agreement.currency}
              </p>
              <div className="mt-2">
                <Terms payment={payment} incoterm={incoterm} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
