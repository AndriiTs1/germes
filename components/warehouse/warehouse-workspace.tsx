import { CheckCircle2, ClipboardCheck, Loader, PackageCheck } from "lucide-react";

import { FulfillmentQueue } from "@/components/warehouse/fulfillment-queue";
import {
  WarehouseKpiSummary,
  type WarehouseKpiCardProps,
} from "@/components/warehouse/warehouse-kpi-row";
import { listWarehouseOrders } from "@/lib/services/warehouse/list-warehouse-orders";

/**
 * Server Component data orchestration for /warehouse. Calls the existing
 * authoritative listWarehouseOrders() read service directly — no
 * currentUserId is passed and no responsibleId/salesperson ownership
 * scoping is introduced here, since Warehouse operators work across
 * salespeople (see that service's own doc comment). The route itself has
 * already required inventory.shipments.process before rendering this
 * component, so no permission check happens here either.
 *
 * READ-ONLY (W2): no expiration housekeeping is run here —
 * listWarehouseOrders already evaluates elapsed ACTIVE reservations
 * read-only — and no lifecycle mutation is wired (Start Processing / Mark
 * Ready / Ship are W3). KPIs are plain counts derived from the same real
 * queue data the table below renders; nothing here invents financial or
 * stock metrics.
 */
export async function WarehouseWorkspace() {
  const orders = await listWarehouseOrders();

  const readyCount = orders.filter((order) => order.status === "READY").length;
  const processingCount = orders.filter((order) => order.status === "PROCESSING").length;
  const confirmedCount = orders.filter((order) => order.status === "CONFIRMED").length;
  const fullyReservedCount = orders.filter((order) => order.isFullyReserved).length;

  const kpis: WarehouseKpiCardProps[] = [
    { label: "Ready", value: String(readyCount), icon: PackageCheck, accent: "violet" },
    { label: "Processing", value: String(processingCount), icon: Loader, accent: "amber" },
    { label: "Confirmed", value: String(confirmedCount), icon: ClipboardCheck, accent: "blue" },
    {
      label: "Fully Reserved",
      value: String(fullyReservedCount),
      icon: CheckCircle2,
      accent: "emerald",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <WarehouseKpiSummary items={kpis} />

      <div>
        <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900">
          Fulfillment Queue
        </h2>
        <div className="mt-3">
          <FulfillmentQueue orders={orders} />
        </div>
      </div>
    </div>
  );
}
