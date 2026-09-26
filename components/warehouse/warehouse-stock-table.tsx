"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { formatKg } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { StockByWarehouseRow, StockCell } from "@/lib/services/warehouse/get-stock-by-warehouse";
import { cn } from "@/lib/utils";

const VISIBLE_LIMIT = 6;

const TH = "px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500";

export type WarehouseStockTableLabels = {
  product: string;
  total: string;
  cellDetail: string;
  unallocatedReserved: string;
  inactiveWarehouses: string;
  attention: string;
  kgUnit: string;
  showAll: string;
  collapse: string;
};

function isNegative(value: string): boolean {
  return value.trim().startsWith("-");
}

function StockCellView({
  cell,
  locale,
  kgUnit,
  detailTemplate,
  strong,
}: {
  cell: StockCell;
  locale: Locale;
  kgUnit: string;
  detailTemplate: string;
  strong?: boolean;
}) {
  return (
    <>
      <div
        className={cn(
          "text-[12.5px] tabular-nums",
          strong ? "font-semibold" : "font-medium",
          isNegative(cell.availableKg) ? "text-rose-600" : "text-slate-900",
        )}
      >
        {formatKg(cell.availableKg, locale)} {kgUnit}
      </div>
      <div className="mt-0.5 text-[11px] whitespace-nowrap tabular-nums text-slate-400">
        {detailTemplate
          .replace("{physical}", formatKg(cell.onHandKg, locale))
          .replace("{reserved}", formatKg(cell.reservedKg, locale))}
      </div>
    </>
  );
}

/**
 * Client-only expand/collapse for the warehouse "Залишки" table. Every row
 * is already loaded (and sorted) server-side — expanding only reveals
 * hidden rows, it never fetches anything. Receives just the strings it
 * renders, not the whole Dictionary, to keep the client payload small.
 */
export function WarehouseStockTable({
  warehouses,
  rows,
  locale,
  labels,
}: {
  warehouses: { id: string; name: string }[];
  rows: StockByWarehouseRow[];
  locale: Locale;
  labels: WarehouseStockTableLabels;
}) {
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? rows : rows.slice(0, VISIBLE_LIMIT);
  const canToggle = rows.length > VISIBLE_LIMIT;
  const kgUnit = labels.kgUnit;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200/70 bg-slate-50/70">
              <th className={cn(TH, "px-5")}>{labels.product}</th>
              {warehouses.map((warehouse) => (
                <th key={warehouse.id} className={cn(TH, "text-right")}>
                  {warehouse.name}
                </th>
              ))}
              <th className={cn(TH, "px-5 text-right")}>{labels.total}</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {visible.map((row) => {
              const requiresAttention =
                isNegative(row.total.availableKg) ||
                Object.values(row.byWarehouse).some((cell) => isNegative(cell.availableKg)) ||
                row.inconsistentReservedKg !== "0";

              return (
                <tr key={row.productId} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-slate-900">{row.name}</span>
                      {requiresAttention ? (
                        <span title={labels.attention}>
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-slate-400">{row.sku}</div>
                  </td>

                  {warehouses.map((warehouse) => (
                    <td key={warehouse.id} className="px-4 py-3 text-right">
                      <StockCellView
                        cell={row.byWarehouse[warehouse.id]}
                        locale={locale}
                        kgUnit={kgUnit}
                        detailTemplate={labels.cellDetail}
                      />
                    </td>
                  ))}

                  <td className="bg-slate-50/40 px-5 py-3 text-right">
                    <StockCellView
                      cell={row.total}
                      locale={locale}
                      kgUnit={kgUnit}
                      detailTemplate={labels.cellDetail}
                      strong
                    />
                    {row.unallocatedReservedKg !== "0" ? (
                      <div className="mt-0.5 text-[11px] whitespace-nowrap text-amber-600">
                        {labels.unallocatedReserved.replace(
                          "{value}",
                          `${formatKg(row.unallocatedReservedKg, locale)} ${kgUnit}`,
                        )}
                      </div>
                    ) : null}
                    {row.inactiveWarehouseOnHandKg !== "0" ? (
                      <div className="mt-0.5 text-[11px] whitespace-nowrap text-amber-600">
                        {labels.inactiveWarehouses.replace(
                          "{value}",
                          `${formatKg(row.inactiveWarehouseOnHandKg, locale)} ${kgUnit}`,
                        )}
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canToggle ? (
        <div className="border-t border-slate-100 px-5 py-2.5">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className="text-[12px] font-medium text-blue-600 hover:text-blue-700"
          >
            {expanded ? labels.collapse : labels.showAll.replace("{count}", String(rows.length))}
          </button>
        </div>
      ) : null}
    </>
  );
}
