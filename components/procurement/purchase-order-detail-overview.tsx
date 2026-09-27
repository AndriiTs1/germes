import type { ReactNode } from "react";

import { DetailSection } from "@/components/sales/detail-section";
import { formatKg, formatMoney, formatShortDate } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { PurchaseOrderDetail } from "@/lib/services/procurement/get-purchase-order-detail";

type OverviewField = { label: string; value: ReactNode };

const EMPTY_VALUE = "—";

/**
 * Same layout as the Sales OrderDetailOverview. The amount is shown only
 * when the service could compute a complete total; otherwise the field
 * explains how many items still have no price instead of showing a
 * partial or zero figure.
 */
export function PurchaseOrderDetailOverview({
  order,
  locale,
  dictionary,
}: {
  order: PurchaseOrderDetail;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const t = dictionary.procurement.orderDetail;

  const fields: OverviewField[] = [
    {
      label: t.overview.supplier,
      value: (
        <>
          {order.supplier.name}
          <span className="ml-1.5 text-[12px] font-normal text-slate-400">{order.supplier.code}</span>
        </>
      ),
    },
    {
      label: t.overview.destinationWarehouse,
      value: order.destinationWarehouse ? (
        order.destinationWarehouse.name
      ) : (
        <span className="font-normal text-slate-400">{t.notSpecified}</span>
      ),
    },
    { label: t.overview.currency, value: order.currency },
    {
      label: t.overview.expectedArrival,
      value: order.expectedArrivalDate ? formatShortDate(order.expectedArrivalDate, locale) : EMPTY_VALUE,
    },
    {
      label: t.overview.orderDate,
      value: order.orderDate ? formatShortDate(order.orderDate, locale) : EMPTY_VALUE,
    },
    { label: t.overview.createdBy, value: order.createdBy.name ?? EMPTY_VALUE },
    {
      label: t.overview.totalQuantity,
      value: `${formatKg(order.totalQuantityKg, locale)} ${dictionary.common.kgUnit}`,
    },
    {
      label: t.overview.amount,
      value:
        order.totalAmount !== null ? (
          formatMoney(order.totalAmount, order.currency, locale)
        ) : (
          <span className="font-normal whitespace-normal text-amber-600">
            {t.overview.incompleteAmount
              .replace("{missing}", String(order.missingPriceCount))
              .replace("{total}", String(order.itemCount))}
          </span>
        ),
    },
  ];

  return (
    <DetailSection title={t.overview.title}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 min-[640px]:grid-cols-3 min-[1024px]:grid-cols-4">
        {fields.map((field) => (
          <div key={field.label} className="min-w-0">
            <dt className="text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
              {field.label}
            </dt>
            <dd className="mt-0.5 truncate text-[13.5px] font-medium text-slate-900">
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </DetailSection>
  );
}
