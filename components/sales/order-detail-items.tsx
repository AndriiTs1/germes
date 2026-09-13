import { DetailSection } from "@/components/sales/detail-section";
import { formatKg, formatMoney } from "@/components/sales/format";
import type { SalesOrderDetailItem } from "@/lib/services/sales/get-sales-order-detail";

type OrderDetailItemsProps = {
  items: SalesOrderDetailItem[];
  currency: string;
};

/**
 * >=1024px: real <table>. <1024px: compact cards — same split convention
 * already established by OrdersList. All totals come from the service
 * (lineTotal is pre-computed via Prisma.Decimal); nothing is recalculated
 * here.
 */
export function OrderDetailItems({ items, currency }: OrderDetailItemsProps) {
  return (
    <DetailSection title="Items">
      <div className="hidden lg:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
              <th scope="col" className="py-2 pr-4">
                Product
              </th>
              <th scope="col" className="py-2 pr-4">
                SKU
              </th>
              <th scope="col" className="py-2 pr-4 text-right">
                Quantity
              </th>
              <th scope="col" className="py-2 pr-4 text-right">
                Price / kg
              </th>
              <th scope="col" className="py-2 text-right">
                Line total
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
                  {formatKg(item.quantityKg)} kg
                </td>
                <td className="py-2.5 pr-4 text-right whitespace-nowrap text-slate-700">
                  {formatMoney(item.pricePerKg, currency)}
                </td>
                <td className="py-2.5 text-right whitespace-nowrap font-semibold text-slate-900">
                  {formatMoney(item.lineTotal, currency)}
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
                {formatMoney(item.lineTotal, currency)}
              </span>
            </div>
            <p className="mt-1 truncate text-[11.5px] text-slate-400">
              {item.sku} · {formatKg(item.quantityKg)} kg @ {formatMoney(item.pricePerKg, currency)}
              /kg
            </p>
          </li>
        ))}
      </ul>
    </DetailSection>
  );
}
