import { DetailSection } from "@/components/sales/detail-section";
import { formatKg, formatMoney } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { PurchaseOrderDetailItem } from "@/lib/services/procurement/get-purchase-order-detail";

type PurchaseOrderDetailItemsProps = {
  items: PurchaseOrderDetailItem[];
  currency: string;
  locale: Locale;
  dictionary: Dictionary;
};

const EMPTY_VALUE = "—";

/**
 * >=1024px: real <table>. <1024px: compact cards — same split as the Sales
 * OrderDetailItems. Line amounts come from the service (Prisma.Decimal);
 * nothing is recalculated here, and an item without a price shows no
 * amount rather than a zero.
 */
export function PurchaseOrderDetailItems({ items, currency, locale, dictionary }: PurchaseOrderDetailItemsProps) {
  const t = dictionary.procurement.orderDetail.items;
  const kg = dictionary.common.kgUnit;

  if (items.length === 0) {
    return (
      <DetailSection title={t.title}>
        <p className="text-[13px] text-slate-400">{t.empty}</p>
      </DetailSection>
    );
  }

  return (
    <DetailSection title={t.title}>
      <div className="hidden lg:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
              <th scope="col" className="py-2 pr-4">
                {t.product}
              </th>
              <th scope="col" className="py-2 pr-4 text-right">
                {t.quantity}
              </th>
              <th scope="col" className="py-2 pr-4 text-right">
                {t.pricePerKg}
              </th>
              <th scope="col" className="py-2 text-right">
                {t.lineAmount}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id} className="text-[13px]">
                <td className="max-w-[260px] py-2.5 pr-4">
                  <span className="block truncate font-medium text-slate-900">{item.productName}</span>
                  <span className="block truncate text-[11.5px] text-slate-400">{item.sku}</span>
                </td>
                <td className="py-2.5 pr-4 text-right whitespace-nowrap text-slate-700">
                  {formatKg(item.quantityKg, locale)} {kg}
                </td>
                <td className="py-2.5 pr-4 text-right whitespace-nowrap text-slate-700">
                  {item.pricePerKg !== null ? (
                    formatMoney(item.pricePerKg, currency, locale)
                  ) : (
                    <span className="text-amber-600">{t.priceNotSpecified}</span>
                  )}
                </td>
                <td className="py-2.5 text-right whitespace-nowrap font-semibold text-slate-900">
                  {item.lineAmount !== null ? (
                    formatMoney(item.lineAmount, currency, locale)
                  ) : (
                    <span className="font-normal text-slate-400">{EMPTY_VALUE}</span>
                  )}
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
              <span className="truncate text-[13px] font-semibold text-slate-900">{item.productName}</span>
              <span className="shrink-0 text-[12.5px] font-semibold text-slate-900">
                {item.lineAmount !== null ? (
                  formatMoney(item.lineAmount, currency, locale)
                ) : (
                  <span className="font-normal text-slate-400">{EMPTY_VALUE}</span>
                )}
              </span>
            </div>
            <p className="mt-1 truncate text-[11.5px] text-slate-400">
              {item.sku} · {formatKg(item.quantityKg, locale)} {kg} ·{" "}
              {item.pricePerKg !== null ? (
                `${formatMoney(item.pricePerKg, currency, locale)}/${kg}`
              ) : (
                <span className="text-amber-600">{t.priceNotSpecified}</span>
              )}
            </p>
          </li>
        ))}
      </ul>
    </DetailSection>
  );
}
