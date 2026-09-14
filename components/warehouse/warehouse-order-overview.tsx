import { DetailSection } from "@/components/sales/detail-section";
import { formatShortDate } from "@/components/sales/format";
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
export function WarehouseOrderOverview({ order }: { order: WarehouseOrderDetail }) {
  const fields: OverviewField[] = [
    { label: "Customer", value: order.customer.name },
    { label: "Customer code", value: order.customer.code },
    { label: "Order date", value: formatShortDate(order.orderDate) },
  ];

  if (order.requestedDate) {
    fields.push({ label: "Requested delivery", value: formatShortDate(order.requestedDate) });
  }

  if (order.responsible?.name) {
    fields.push({ label: "Responsible", value: order.responsible.name });
  }

  if (order.shippedAt) {
    fields.push({ label: "Shipped", value: formatShortDate(order.shippedAt) });
  }

  return (
    <DetailSection title="Overview">
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
