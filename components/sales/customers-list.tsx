import { Users } from "lucide-react";
import Link from "next/link";

import { formatMoney, formatShortDate } from "@/components/sales/format";
import { getCustomerStatusLabel, CUSTOMER_STATUS_STYLES } from "@/components/sales/customer-status";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { pluralize } from "@/lib/i18n/pluralize";
import type {
  CustomerReceivableSummary,
  SalesCustomerListItem,
} from "@/lib/services/sales/list-sales-customers";
import { cn } from "@/lib/utils";

type CustomersListProps = {
  customers: SalesCustomerListItem[];
  emptyMessage: string;
  locale: Locale;
  dictionary: Dictionary;
};

function StatusBadge({ status, statusLabels }: { status: string; statusLabels: Dictionary["status"]["customer"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap",
        CUSTOMER_STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600",
      )}
    >
      {getCustomerStatusLabel(statusLabels, status)}
    </span>
  );
}

/**
 * Renders one line per currency, never a combined cross-currency total.
 * Empty/zero-only lines collapse to a restrained dash — this is how
 * "no outstanding receivables" and "nothing overdue" both stay honest
 * without an empty-looking cell.
 */
function ReceivableLines({
  receivables,
  variant,
  align,
  locale,
}: {
  receivables: CustomerReceivableSummary[];
  variant: "outstanding" | "overdue";
  align: "start" | "end";
  locale: Locale;
}) {
  const lines = receivables
    .map((r) => ({
      currency: r.currency,
      value: variant === "outstanding" ? r.totalOutstanding : r.overdueOutstanding,
    }))
    .filter((line) => line.value !== "0");

  if (lines.length === 0) {
    return <span className="text-slate-300">—</span>;
  }

  return (
    <div className={cn("flex flex-col gap-0.5", align === "end" ? "items-end" : "items-start")}>
      {lines.map((line) => (
        <span
          key={line.currency}
          className={cn(
            "whitespace-nowrap",
            variant === "overdue" ? "font-semibold text-rose-600" : "text-slate-900",
          )}
        >
          {formatMoney(line.value, line.currency, locale)}
        </span>
      ))}
    </div>
  );
}

/**
 * >=1024px: real <table>, with only the customer name cell linking to
 * /sales/customers/[id] (matching OrdersList's orderNumber-cell pattern —
 * the <tr> itself is never wrapped/clickable). <1024px: the whole card is
 * a single Link, matching OrdersList's mobile convention exactly.
 */
export function CustomersList({ customers, emptyMessage, locale, dictionary }: CustomersListProps) {
  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200/70 bg-white px-4 py-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]">
        <Users className="h-5 w-5 text-slate-300" strokeWidth={1.75} />
        <p className="text-[13px] font-medium text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  const t = dictionary.common.table;

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)] lg:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
              <th scope="col" className="px-4 py-3">
                {t.customer}
              </th>
              <th scope="col" className="px-4 py-3">
                {t.status}
              </th>
              <th scope="col" className="px-4 py-3">
                {dictionary.customers.table.lastPurchase}
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                {dictionary.customers.table.receivable}
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                {dictionary.customers.table.overdue}
              </th>
              <th scope="col" className="px-4 py-3">
                {dictionary.customers.table.nextAction}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map((customer) => (
              <tr key={customer.id} className="text-[13px]">
                <td className="max-w-[220px] px-4 py-3">
                  <Link
                    href={`/sales/customers/${customer.id}`}
                    className="block truncate rounded-sm font-medium text-slate-900 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none"
                  >
                    {customer.name}
                  </Link>
                  <p className="truncate text-[11.5px] text-slate-400">
                    {customer.code}
                    {customer.activeOrdersCount > 0
                      ? ` · ${pluralize(locale, customer.activeOrdersCount, dictionary.customers.activeOrders)}`
                      : ""}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={customer.status} statusLabels={dictionary.status.customer} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                  {customer.lastPurchaseAt ? formatShortDate(customer.lastPurchaseAt, locale) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <ReceivableLines
                    receivables={customer.receivables}
                    variant="outstanding"
                    align="end"
                    locale={locale}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <ReceivableLines
                    receivables={customer.receivables}
                    variant="overdue"
                    align="end"
                    locale={locale}
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                  {customer.nextActionAt ? formatShortDate(customer.nextActionAt, locale) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 lg:hidden">
        {customers.map((customer) => {
          const contact = customer.email ?? customer.phone;

          return (
            <li key={customer.id}>
              <Link
                href={`/sales/customers/${customer.id}`}
                className="block rounded-2xl border border-slate-200/70 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)] transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold text-slate-900">
                    {customer.name}
                  </span>
                  <StatusBadge status={customer.status} statusLabels={dictionary.status.customer} />
                </div>
                <p className="mt-0.5 truncate text-[11.5px] text-slate-400">
                  {customer.code}
                  {contact ? ` · ${contact}` : ""}
                </p>
                {customer.activeOrdersCount > 0 ? (
                  <p className="mt-0.5 truncate text-[11.5px] text-slate-400">
                    {pluralize(locale, customer.activeOrdersCount, dictionary.customers.activeOrders)}
                  </p>
                ) : null}

                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[11.5px]">
                  <div>
                    <p className="text-slate-400">{dictionary.customers.table.lastPurchase}</p>
                    <p className="mt-0.5 font-medium text-slate-700">
                      {customer.lastPurchaseAt ? formatShortDate(customer.lastPurchaseAt, locale) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">{dictionary.customers.table.nextAction}</p>
                    <p className="mt-0.5 font-medium text-slate-700">
                      {customer.nextActionAt ? formatShortDate(customer.nextActionAt, locale) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">{dictionary.customers.table.receivable}</p>
                    <div className="mt-0.5">
                      <ReceivableLines
                        receivables={customer.receivables}
                        variant="outstanding"
                        align="start"
                        locale={locale}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-slate-400">{dictionary.customers.table.overdue}</p>
                    <div className="mt-0.5">
                      <ReceivableLines
                        receivables={customer.receivables}
                        variant="overdue"
                        align="start"
                        locale={locale}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
