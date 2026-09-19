import { CheckCircle2, ClipboardCheck, Loader, PackageCheck } from "lucide-react";

import { FulfillmentQueue } from "@/components/warehouse/fulfillment-queue";
import { WarehouseBatchStock } from "@/components/warehouse/warehouse-batch-stock";
import { WarehouseStockOverview } from "@/components/warehouse/warehouse-stock-overview";
import {
  WarehouseKpiSummary,
  type WarehouseKpiCardProps,
} from "@/components/warehouse/warehouse-kpi-row";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { getStockAvailability } from "@/lib/services/sales/get-stock-availability";
import { listBatchWarehouseStock } from "@/lib/services/warehouse/list-batch-warehouse-stock";
import { listWarehouseOrders } from "@/lib/services/warehouse/list-warehouse-orders";

type WarehouseWorkspaceProps = {
  locale: Locale;
  dictionary: Dictionary;
  canReadStock: boolean;
};

/**
 * Server Component data orchestration for /warehouse. Calls the existing
 * authoritative listWarehouseOrders() read service directly — no
 * currentUserId is passed and no responsibleId/salesperson ownership
 * scoping is introduced here, since Warehouse operators work across
 * salespeople (see that service's own doc comment). The route itself has
 * already required workspace.warehouse.access before rendering this
 * component, so no permission check happens here either.
 *
 * READ-ONLY (W2): no expiration housekeeping is run here —
 * listWarehouseOrders already evaluates elapsed ACTIVE reservations
 * read-only — and no lifecycle mutation is wired (Start Processing / Mark
 * Ready / Ship are W3). KPIs are plain counts derived from the same real
 * queue data the table below renders; nothing here invents financial or
 * stock metrics.
 */
export async function WarehouseWorkspace({
  locale,
  dictionary,
  canReadStock,
}: WarehouseWorkspaceProps) {
  const [orders, stock, batchStock] = await Promise.all([
    listWarehouseOrders(),
    canReadStock ? getStockAvailability() : Promise.resolve(null),
    canReadStock ? listBatchWarehouseStock() : Promise.resolve(null),
  ]);



  const readyCount = orders.filter((order) => order.status === "READY").length;
  const processingCount = orders.filter((order) => order.status === "PROCESSING").length;
  const confirmedCount = orders.filter((order) => order.status === "CONFIRMED").length;
  const fullyReservedCount = orders.filter((order) => order.isFullyReserved).length;

  const kpi = dictionary.warehouse.workspace.kpi;

  const kpis: WarehouseKpiCardProps[] = [
    { label: kpi.ready, value: String(readyCount), icon: PackageCheck, accent: "violet" },
    { label: kpi.processing, value: String(processingCount), icon: Loader, accent: "amber" },
    { label: kpi.confirmed, value: String(confirmedCount), icon: ClipboardCheck, accent: "blue" },
    {
      label: kpi.fullyReserved,
      value: String(fullyReservedCount),
      icon: CheckCircle2,
      accent: "emerald",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <WarehouseKpiSummary items={kpis} />

      {stock ? (
        <WarehouseStockOverview
          stock={stock}
          locale={locale}
          dictionary={dictionary}
        />
      ) : null}

      {batchStock ? (
        <WarehouseBatchStock
          rows={batchStock}
          locale={locale}
          dictionary={dictionary}
        />
      ) : null}

      <div>
        <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900">
          {dictionary.warehouse.workspace.fulfillmentQueueTitle}
        </h2>
        <div className="mt-3">
          <FulfillmentQueue orders={orders} locale={locale} dictionary={dictionary} />
        </div>
      </div>
    </div>
  );
}
