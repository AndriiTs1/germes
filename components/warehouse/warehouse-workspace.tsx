import { CheckCircle2, ClipboardCheck, Loader, PackageCheck } from "lucide-react";

import { FulfillmentQueue } from "@/components/warehouse/fulfillment-queue";
import { WarehouseSectionPreview } from "@/components/warehouse/warehouse-section-preview";
import { WarehouseBatchStock } from "@/components/warehouse/warehouse-batch-stock";
import { WarehouseStockByWarehouse } from "@/components/warehouse/warehouse-stock-by-warehouse";
import {
  WarehouseKpiSummary,
  type WarehouseKpiCardProps,
} from "@/components/warehouse/warehouse-kpi-row";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { getStockByWarehouse } from "@/lib/services/warehouse/get-stock-by-warehouse";
import { listBatchWarehouseStock } from "@/lib/services/warehouse/list-batch-warehouse-stock";
import { listWarehouseOrders } from "@/lib/services/warehouse/list-warehouse-orders";

type WarehouseWorkspaceProps = {
  locale: Locale;
  dictionary: Dictionary;
  canReadStock: boolean;
  canProcessShipments: boolean;
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
  canProcessShipments,
}: WarehouseWorkspaceProps) {
  const [orders, stock, batchStock] = await Promise.all([
    listWarehouseOrders(),
    canReadStock ? getStockByWarehouse() : Promise.resolve(null),
    canReadStock ? listBatchWarehouseStock() : Promise.resolve(null),
  ]);



  const readyCount = orders.filter((order) => order.status === "READY").length;
  const processingCount = orders.filter((order) => order.status === "PROCESSING").length;
  const confirmedCount = orders.filter((order) => order.status === "CONFIRMED").length;
  const fullyReservedCount = orders.filter((order) => order.isFullyReserved).length;
  const readyToProcessCount = orders.filter(
    (order) => order.status === "CONFIRMED" && order.isFullyReserved,
  ).length;

  const kpi = dictionary.warehouse.workspace.kpi;

  const kpis: WarehouseKpiCardProps[] = [
    { label: kpi.ready, value: String(readyCount), icon: PackageCheck, accent: "violet" },
    { label: kpi.processing, value: String(processingCount), icon: Loader, accent: "amber" },
    { label: kpi.confirmed, value: String(confirmedCount), icon: ClipboardCheck, accent: "blue" },
    {
      label: canProcessShipments ? kpi.fullyReserved : kpi.readyToProcess,
      value: String(canProcessShipments ? fullyReservedCount : readyToProcessCount),
      icon: CheckCircle2,
      accent: "emerald",
    },
  ];

  const fulfillmentQueue = (
    <div>
      <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900">
        {dictionary.warehouse.workspace.fulfillmentQueueTitle}
      </h2>
      <div className="mt-3">
        <FulfillmentQueue orders={orders} locale={locale} dictionary={dictionary} />
      </div>
    </div>
  );

  // Warehouse operators keep the existing operational workspace unchanged.
  if (canProcessShipments) {
    return (
      <div className="flex flex-col gap-4">
        <WarehouseKpiSummary items={kpis} />

        {stock ? (
          <WarehouseStockByWarehouse
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

        {fulfillmentQueue}
      </div>
    );
  }

  const ownerQueuePreviewCount = 5;
  const ownerQueuePreview = orders.slice(0, ownerQueuePreviewCount);
  const ownerBatchPreviewCount = 6;
  const ownerBatchPreview = batchStock?.slice(0, ownerBatchPreviewCount) ?? [];
  const queueToggleLabels = dictionary.warehouse.workspace.stock;

  // Read-only viewers (OWNER / ADMIN) see stock first, then the compact operational queue.
  return (
    <div className="flex flex-col gap-4">
      <WarehouseKpiSummary items={kpis} />

      {stock ? (
        <WarehouseStockByWarehouse
          stock={stock}
          locale={locale}
          dictionary={dictionary}
        />
      ) : null}

      <div>
        <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900">
          {dictionary.warehouse.workspace.fulfillmentQueueTitle}
        </h2>
        <div className="mt-3">
          <WarehouseSectionPreview
            preview={
              <FulfillmentQueue
                orders={ownerQueuePreview}
                locale={locale}
                dictionary={dictionary}
              />
            }
            full={
              <FulfillmentQueue
                orders={orders}
                locale={locale}
                dictionary={dictionary}
              />
            }
            totalCount={orders.length}
            previewCount={ownerQueuePreviewCount}
            showAllLabel={queueToggleLabels.showAll.replace("{count}", String(orders.length))}
            collapseLabel={queueToggleLabels.collapse}
          />
        </div>
      </div>

      {batchStock ? (
        <WarehouseSectionPreview
          preview={
            <WarehouseBatchStock
              rows={ownerBatchPreview}
              locale={locale}
              dictionary={dictionary}
            />
          }
          full={
            <WarehouseBatchStock
              rows={batchStock}
              locale={locale}
              dictionary={dictionary}
            />
          }
          totalCount={batchStock.length}
          previewCount={ownerBatchPreviewCount}
          showAllLabel={queueToggleLabels.showAll.replace("{count}", String(batchStock.length))}
          collapseLabel={queueToggleLabels.collapse}
        />
      ) : null}
    </div>
  );
}
