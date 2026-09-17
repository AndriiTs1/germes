import { DetailSection } from "@/components/sales/detail-section";
import { formatShortDate } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { WarehouseOrderDetail } from "@/lib/services/warehouse/get-warehouse-order-detail";

type OverviewField = { label: string; value: string };

/**
 * Operational information only — Customer/code/dates/responsible/shippedAt.
 * Unlike OrderDetailOverview (SALES, which omits "Responsible" because that
 * page is only ever reachable by the order's own responsible salesperson),
 * Warehouse works across salespeople, so knowing who the order belongs to
 * is genuine operational context here. No receivables/accounting data —
 * this route never queries Receivable at all.
 */
export function WarehouseOrderOverview({
  order,
  locale,
  dictionary,
}: {
  order: WarehouseOrderDetail;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const t = dictionary.warehouse.orderDetail.overview;
  const fields: OverviewField[] = [
    { label: t.customer, value: order.customer.name },
    { label: t.customerCode, value: order.customer.code },
    { label: t.orderDate, value: formatShortDate(order.orderDate, locale) },
  ];

  if (order.requestedDate) {
    fields.push({ label: t.requestedDelivery, value: formatShortDate(order.requestedDate, locale) });
  }

  if (order.responsible?.name) {
    fields.push({ label: t.responsible, value: order.responsible.name });
  }

  if (order.shippedAt) {
    fields.push({ label: t.shipped, value: formatShortDate(order.shippedAt, locale) });
  }

  return (
    <DetailSection title={t.title}>
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
