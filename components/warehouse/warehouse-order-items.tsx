import { DetailSection } from "@/components/sales/detail-section";
import { formatKg } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { WarehouseOrderDetailItem } from "@/lib/services/warehouse/get-warehouse-order-detail";
import { cn } from "@/lib/utils";

function ItemFulfillmentBadge({
  isFullyReserved,
  isShipped,
  dictionary,
}: {
  isFullyReserved: boolean;
  isShipped: boolean;
  dictionary: Dictionary["warehouse"]["orderDetail"]["items"];
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap",
        isShipped || isFullyReserved
          ? "bg-emerald-50 text-emerald-600"
          : "bg-amber-50 text-amber-600",
      )}
    >
      {isShipped ? dictionary.shipped : isFullyReserved ? dictionary.fullyReserved : dictionary.notFullyReserved}
    </span>
  );
}

/**
 * No pricePerKg/lineTotal/currency — Warehouse operates on physical
 * quantities, not money. usableReservedQuantityKg already excludes
 * elapsed/malformed reservations (see getWarehouseOrderDetail); for a
 * SHIPPED order this is naturally 0 for every item (reservations were
 * consumed, not left ACTIVE) — that is correct historical state, not
 * misrepresented as an unfulfilled order.
 *
 * >=1024px: real <table>. <1024px: compact cards — same split convention
 * already established by OrderDetailItems/OrdersList.
 */
export function WarehouseOrderItems({
  items,
  orderStatus,
  locale,
  dictionary,
}: {
  items: WarehouseOrderDetailItem[];
  orderStatus: string;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const isShipped = orderStatus === "SHIPPED";
  const t = dictionary.warehouse.orderDetail.items;
  const tableLabels = dictionary.common.table;

  return (
    <DetailSection title={t.title}>
      <div className="hidden lg:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
              <th scope="col" className="py-2 pr-4">
                {tableLabels.product}
              </th>
              <th scope="col" className="py-2 pr-4">
                {tableLabels.sku}
              </th>
              <th scope="col" className="py-2 pr-4 text-right">
                {t.ordered}
              </th>
              <th scope="col" className="py-2 pr-4 text-right">
                {t.reserved}
              </th>
              <th scope="col" className="py-2 pr-4">
                {tableLabels.fulfillment}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id} className="text-[13px]">
                <td className="max-w-[220px] truncate py-3 pr-4 font-medium text-slate-900">
                  {item.productName}
                </td>
                <td className="py-3 pr-4 whitespace-nowrap text-slate-500">{item.sku}</td>
                <td className="py-3 pr-4 text-right whitespace-nowrap text-slate-700">
                  {formatKg(item.orderedQuantityKg, locale)} {dictionary.common.kgUnit}
                </td>
                <td className="py-3 pr-4 text-right whitespace-nowrap text-slate-700">
                  {isShipped ? "—" : `${formatKg(item.usableReservedQuantityKg, locale)} ${dictionary.common.kgUnit}`}
                </td>
                <td className="py-3 pr-4">
                  <ItemFulfillmentBadge
                    isFullyReserved={item.isFullyReserved}
                    isShipped={isShipped}
                    dictionary={t}
                  />
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
              <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-900">
                {item.productName}
              </p>
              <ItemFulfillmentBadge
                isFullyReserved={item.isFullyReserved}
                isShipped={isShipped}
                dictionary={t}
              />
            </div>
            <p className="mt-0.5 text-[11.5px] text-slate-400">{item.sku}</p>
            <p className="mt-1 text-[11.5px] text-slate-500">
              {isShipped
                ? `${formatKg(item.orderedQuantityKg, locale)} ${dictionary.common.kgUnit} ${t.mobileShippedSuffix}`
                : `${formatKg(item.usableReservedQuantityKg, locale)} / ${formatKg(item.orderedQuantityKg, locale)} ${dictionary.common.kgUnit} ${t.mobileReservedSuffix}`}
            </p>
          </li>
        ))}
      </ul>
    </DetailSection>
  );
}
