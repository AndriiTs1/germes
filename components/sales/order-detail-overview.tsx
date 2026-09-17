import Link from "next/link";
import type { ReactNode } from "react";

import { DetailSection } from "@/components/sales/detail-section";
import { formatKg, formatMoney, formatShortDate } from "@/components/sales/format";
import type { SalesOrderDetail } from "@/lib/services/sales/get-sales-order-detail";

type OverviewField = { label: string; value: ReactNode };

/**
 * Responsible salesperson is deliberately omitted: this page is only ever
 * reachable when responsibleId === the viewer's own id, so showing
 * "Responsible: <your own name>" here would just duplicate the identity
 * already visible in the shared shell/sidebar.
 */
export function OrderDetailOverview({ order }: { order: SalesOrderDetail }) {
  const fields: OverviewField[] = [
    {
      label: "Customer",
      value: (
        <Link
          href={`/sales/customers/${order.customer.id}`}
          className="rounded-sm underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none"
        >
          {order.customer.name}
        </Link>
      ),
    },
    { label: "Order date", value: formatShortDate(order.orderDate) },
  ];

  if (order.requestedDate) {
    fields.push({ label: "Requested delivery", value: formatShortDate(order.requestedDate) });
  }
  if (order.shippedAt) {
    fields.push({ label: "Shipped", value: formatShortDate(order.shippedAt) });
  }

  fields.push({ label: "Total quantity", value: `${formatKg(order.totalQuantityKg)} kg` });
  fields.push({ label: "Total value", value: formatMoney(order.totalValue, order.currency) });

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
