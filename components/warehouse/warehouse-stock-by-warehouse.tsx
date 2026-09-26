import { Boxes } from "lucide-react";

import { WarehouseStockTable } from "@/components/warehouse/warehouse-stock-table";
import { INTL_LOCALE_MAP, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { StockByWarehouse } from "@/lib/services/warehouse/get-stock-by-warehouse";

type WarehouseStockByWarehouseProps = {
  stock: StockByWarehouse;
  locale: Locale;
  dictionary: Dictionary;
};

/**
 * "Залишки" for /warehouse: one row per product, one column per active
 * warehouse (from the database, never hardcoded) plus a company total.
 * Each cell shows available stock, with on-hand / reserved underneath.
 * Presentation only — receives getStockByWarehouse() and never queries.
 * The total can exceed the sum of warehouse columns only by the explicitly
 * labelled reservation-without-warehouse and inactive-warehouse amounts.
 *
 * Rows are sorted here (server-side) and handed to the client
 * WarehouseStockTable together with only the strings it renders, which
 * owns the show-all / collapse toggle.
 */
export function WarehouseStockByWarehouse({
  stock,
  locale,
  dictionary,
}: WarehouseStockByWarehouseProps) {
  const labels = dictionary.warehouse.workspace.stock;
  const collator = new Intl.Collator(INTL_LOCALE_MAP[locale]);
  const rows = [...stock.rows].sort((a, b) => collator.compare(a.name, b.name));

  return (
    <section>
      <div className="flex items-center gap-2">
        <Boxes className="h-4 w-4 text-slate-500" aria-hidden="true" />
        <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900">
          {labels.overviewTitle}
        </h2>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]">
        {rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-slate-500">{labels.empty}</div>
        ) : (
          <WarehouseStockTable
            warehouses={stock.warehouses.map((warehouse) => ({ id: warehouse.id, name: warehouse.name }))}
            rows={rows}
            locale={locale}
            labels={{
              product: labels.product,
              total: labels.total,
              cellDetail: labels.cellDetail,
              unallocatedReserved: labels.unallocatedReserved,
              inactiveWarehouses: labels.inactiveWarehouses,
              attention: labels.attention,
              kgUnit: dictionary.common.kgUnit,
              showAll: labels.showAll,
              collapse: labels.collapse,
              warehouseFilterLabel: labels.warehouseFilter.label,
              allWarehouses: labels.warehouseFilter.all,
            }}
          />
        )}
      </div>
    </section>
  );
}
