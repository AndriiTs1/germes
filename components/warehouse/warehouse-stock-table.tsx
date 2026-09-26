"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { formatKg } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { StockByWarehouseRow, StockCell } from "@/lib/services/warehouse/get-stock-by-warehouse";
import { cn } from "@/lib/utils";

const VISIBLE_LIMIT = 6;
const ALL_WAREHOUSES = "all";

const PILL = "rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors";

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
  warehouseFilterLabel: string;
  allWarehouses: string;
};

function isNegative(value: string): boolean {
  return value.trim().startsWith("-");
}

function rowRequiresAttention(row: StockByWarehouseRow): boolean {
  return (
    isNegative(row.total.availableKg) ||
    Object.values(row.byWarehouse).some((cell) => isNegative(cell.availableKg)) ||
    row.inconsistentReservedKg !== "0"
  );
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

/** One labelled warehouse/total line inside a mobile product card. */
function MobileStockLine({
  label,
  cell,
  locale,
  kgUnit,
  detailTemplate,
  strong,
}: {
  label: string;
  cell: StockCell;
  locale: Locale;
  kgUnit: string;
  detailTemplate: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className={cn("text-[12px] text-slate-500", strong && "font-medium text-slate-700")}>{label}</dt>
      <dd className="text-right">
        <StockCellView
          cell={cell}
          locale={locale}
          kgUnit={kgUnit}
          detailTemplate={detailTemplate}
          strong={strong}
        />
      </dd>
    </div>
  );
}

/**
 * Client-only expand/collapse for the warehouse "Залишки" table. Every row
 * is already loaded (and sorted) server-side — expanding only reveals
 * hidden rows, it never fetches anything. Receives just the strings it
 * renders, not the whole Dictionary, to keep the client payload small.
 *
 * The warehouse switcher is presentation-only too: "all" shows every
 * warehouse column plus the total (with its company-wide notes); a single
 * warehouse shows only that column, and ⚠ then reflects that warehouse's
 * own negative availability only. Rows (and the collapse state) are
 * unaffected by the switcher.
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
  const [selected, setSelected] = useState<string>(ALL_WAREHOUSES);

  const single = selected !== ALL_WAREHOUSES && warehouses.some((w) => w.id === selected);
  const shownWarehouses = single ? warehouses.filter((w) => w.id === selected) : warehouses;
  const requiresAttention = (row: StockByWarehouseRow) =>
    single ? isNegative(row.byWarehouse[selected].availableKg) : rowRequiresAttention(row);

  const visible = expanded ? rows : rows.slice(0, VISIBLE_LIMIT);
  const canToggle = rows.length > VISIBLE_LIMIT;
  const kgUnit = labels.kgUnit;

  return (
    <>
      {warehouses.length > 1 ? (
        <div
          role="group"
          aria-label={labels.warehouseFilterLabel}
          className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2.5 md:px-5"
        >
          <span className="mr-1 text-[12px] text-slate-500">{labels.warehouseFilterLabel}:</span>
          {[{ id: ALL_WAREHOUSES, name: labels.allWarehouses }, ...warehouses].map((option) => {
            const isActive = option.id === (single ? selected : ALL_WAREHOUSES);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setSelected(option.id)}
                className={cn(
                  PILL,
                  isActive
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {option.name}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* >=768px: table (fits the 720px min width without sidebar). <768px: cards below. */}
      <div className="hidden overflow-x-auto md:block">
        <table
          className={
            single
              ? "w-full min-w-[480px] border-collapse text-left"
              : "w-full min-w-[720px] border-collapse text-left"
          }
        >
          <thead>
            <tr className="border-b border-slate-200/70 bg-slate-50/70">
              <th className={cn(TH, "px-5")}>{labels.product}</th>
              {shownWarehouses.map((warehouse) => (
                <th key={warehouse.id} className={cn(TH, "text-right")}>
                  {warehouse.name}
                </th>
              ))}
              {single ? null : <th className={cn(TH, "px-5 text-right")}>{labels.total}</th>}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {visible.map((row) => {
              const rowAttention = requiresAttention(row);

              return (
                <tr key={row.productId} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-slate-900">{row.name}</span>
                      {rowAttention ? (
                        <span title={labels.attention}>
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-slate-400">{row.sku}</div>
                  </td>

                  {shownWarehouses.map((warehouse) => (
                    <td key={warehouse.id} className="px-4 py-3 text-right">
                      <StockCellView
                        cell={row.byWarehouse[warehouse.id]}
                        locale={locale}
                        kgUnit={kgUnit}
                        detailTemplate={labels.cellDetail}
                        strong={single}
                      />
                    </td>
                  ))}

                  {single ? null : (
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
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* <768px: one card per product — warehouses stacked instead of columns, no horizontal scroll. */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {visible.map((row) => (
          <li key={row.productId} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="min-w-0 truncate text-[13px] font-medium text-slate-900">{row.name}</span>
              {requiresAttention(row) ? (
                <span title={labels.attention} className="shrink-0">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 text-[11.5px] text-slate-400">{row.sku}</div>

            <dl className="mt-2.5 space-y-2">
              {shownWarehouses.map((warehouse) => (
                <MobileStockLine
                  key={warehouse.id}
                  label={warehouse.name}
                  cell={row.byWarehouse[warehouse.id]}
                  locale={locale}
                  kgUnit={kgUnit}
                  detailTemplate={labels.cellDetail}
                  strong={single}
                />
              ))}
              {single ? null : (
                <div className="border-t border-slate-100 pt-2">
                  <MobileStockLine
                    label={labels.total}
                    cell={row.total}
                    locale={locale}
                    kgUnit={kgUnit}
                    detailTemplate={labels.cellDetail}
                    strong
                  />
                  {row.unallocatedReservedKg !== "0" ? (
                    <p className="mt-0.5 text-right text-[11px] text-amber-600">
                      {labels.unallocatedReserved.replace(
                        "{value}",
                        `${formatKg(row.unallocatedReservedKg, locale)} ${kgUnit}`,
                      )}
                    </p>
                  ) : null}
                  {row.inactiveWarehouseOnHandKg !== "0" ? (
                    <p className="mt-0.5 text-right text-[11px] text-amber-600">
                      {labels.inactiveWarehouses.replace(
                        "{value}",
                        `${formatKg(row.inactiveWarehouseOnHandKg, locale)} ${kgUnit}`,
                      )}
                    </p>
                  ) : null}
                </div>
              )}
            </dl>
          </li>
        ))}
      </ul>

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
