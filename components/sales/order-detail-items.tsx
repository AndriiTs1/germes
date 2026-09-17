import { DetailSection } from "@/components/sales/detail-section";
import { formatKg, formatMoney } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { SalesOrderDetailItem } from "@/lib/services/sales/get-sales-order-detail";

type OrderDetailItemsProps = {
  items: SalesOrderDetailItem[];
  currency: string;
  locale: Locale;
  dictionary: Dictionary;
};

/**
 * >=1024px: real <table>. <1024px: compact cards — same split convention
 * already established by OrdersList. All totals come from the service
 * (lineTotal is pre-computed via Prisma.Decimal); nothing is recalculated
 * here.
 */
export function OrderDetailItems({ items, currency, locale, dictionary }: OrderDetailItemsProps) {
  const t = dictionary.common.table;

  return (
    <DetailSection title={dictionary.orderDetail.items.title}>
      <div className="hidden lg:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
              <th scope="col" className="py-2 pr-4">
                {t.product}
              </th>
              <th scope="col" className="py-2 pr-4">
                {t.sku}
              </th>
              <th scope="col" className="py-2 pr-4 text-right">
                {t.quantity}
              </th>
              <th scope="col" className="py-2 pr-4 text-right">
                {dictionary.orderDetail.items.pricePerKg}
              </th>
              <th scope="col" className="py-2 text-right">
                {dictionary.orderDetail.items.lineTotal}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id} className="text-[13px]">
                <td className="max-w-[220px] truncate py-2.5 pr-4 font-medium text-slate-900">
                  {item.productName}
                </td>
                <td className="py-2.5 pr-4 whitespace-nowrap text-slate-500">{item.sku}</td>
                <td className="py-2.5 pr-4 text-right whitespace-nowrap text-slate-700">
                  {formatKg(item.quantityKg, locale)} {dictionary.common.kgUnit}
                </td>
                <td className="py-2.5 pr-4 text-right whitespace-nowrap text-slate-700">
                  {formatMoney(item.pricePerKg, currency, locale)}
                </td>
                <td className="py-2.5 text-right whitespace-nowrap font-semibold text-slate-900">
                  {formatMoney(item.lineTotal, currency, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 lg:hidden">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-slate-100 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[13px] font-semibold text-slate-900">
                {item.productName}
              </span>
              <span className="shrink-0 text-[12.5px] font-semibold text-slate-900">
                {formatMoney(item.lineTotal, currency, locale)}
              </span>
            </div>
            <p className="mt-1 truncate text-[11.5px] text-slate-400">
              {item.sku} · {formatKg(item.quantityKg, locale)} {dictionary.common.kgUnit} @{" "}
              {formatMoney(item.pricePerKg, currency, locale)}/{dictionary.common.kgUnit}
            </p>
          </li>
        ))}
      </ul>
    </DetailSection>
  );
}
