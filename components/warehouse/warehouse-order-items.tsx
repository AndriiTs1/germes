import { DetailSection } from "@/components/sales/detail-section";
import { formatKg } from "@/components/sales/format";
import type { WarehouseOrderDetailItem } from "@/lib/services/warehouse/get-warehouse-order-detail";
import { cn } from "@/lib/utils";

function ItemFulfillmentBadge({
  isFullyReserved,
  isShipped,
}: {
  isFullyReserved: boolean;
  isShipped: boolean;
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
      {isShipped ? "Shipped" : isFullyReserved ? "Fully reserved" : "Not fully reserved"}
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
}: {
  items: WarehouseOrderDetailItem[];
  orderStatus: string;
}) {
  const isShipped = orderStatus === "SHIPPED";
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
                Ordered
              </th>
              <th scope="col" className="py-2 pr-4 text-right">
                Reserved
              </th>
              <th scope="col" className="py-2 pr-4">
                Fulfillment
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
                  {formatKg(item.orderedQuantityKg)} kg
                </td>
                <td className="py-3 pr-4 text-right whitespace-nowrap text-slate-700">
                  {isShipped ? "—" : `${formatKg(item.usableReservedQuantityKg)} kg`}
                </td>
                <td className="py-3 pr-4">
                  <ItemFulfillmentBadge isFullyReserved={item.isFullyReserved} isShipped={isShipped} />
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
              <ItemFulfillmentBadge isFullyReserved={item.isFullyReserved} isShipped={isShipped} />
            </div>
            <p className="mt-0.5 text-[11.5px] text-slate-400">{item.sku}</p>
            <p className="mt-1 text-[11.5px] text-slate-500">
              {isShipped
                ? `${formatKg(item.orderedQuantityKg)} kg shipped`
                : `${formatKg(item.usableReservedQuantityKg)} / ${formatKg(item.orderedQuantityKg)} kg reserved`}
            </p>
          </li>
        ))}
      </ul>
    </DetailSection>
  );
}
