import { Layers3 } from "lucide-react";

import { formatKg } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { WarehouseBatchStockRow } from "@/lib/services/warehouse/list-batch-warehouse-stock";

type WarehouseBatchStockProps = {
  rows: WarehouseBatchStockRow[];
  locale: Locale;
  dictionary: Dictionary;
};

export function WarehouseBatchStock({
  rows,
  locale,
  dictionary,
}: WarehouseBatchStockProps) {
  const labels = dictionary.warehouse.workspace.stock;
  const kgUnit = dictionary.common.kgUnit;

  return (
    <section>
      <div className="flex items-center gap-2">
        <Layers3 className="h-4 w-4 text-slate-500" aria-hidden="true" />
        <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900">
          {labels.batchWarehouseTitle}
        </h2>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]">
        {rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-slate-500">
            {labels.noBatchStock}
          </div>
        ) : (
          <>
            {/* >=1024px: table (880px min width fits once the content area is wide enough). <1024px: cards below. */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[880px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200/70 bg-slate-50/70">
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
                      {labels.product}
                    </th>
                    <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
                      {labels.batch}
                    </th>
                    <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
                      {labels.warehouse}
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
                      {labels.physical}
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
                      {labels.reserved}
                    </th>
                    <th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
                      {labels.available}
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const available = Number(row.availableKg);

                    return (
                      <tr
                        key={`${row.batchId}:${row.warehouseId}`}
                        className="transition-colors hover:bg-slate-50/60"
                      >
                        <td className="px-5 py-3.5">
                          <div className="text-[13px] font-medium text-slate-900">
                            {row.productName}
                          </div>
                          <div className="mt-0.5 text-[11.5px] text-slate-400">
                            {row.productSku}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-[12.5px] font-medium text-slate-700">
                          {row.batchNumber}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="text-[12.5px] text-slate-700">
                            {row.warehouseName}
                          </div>
                          <div className="mt-0.5 text-[11.5px] text-slate-400">
                            {row.warehouseCode}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right text-[12.5px] tabular-nums text-slate-700">
                          {formatKg(row.onHandKg, locale)} {kgUnit}
                        </td>

                        <td className="px-4 py-3.5 text-right text-[12.5px] tabular-nums text-slate-700">
                          {formatKg(row.activeReservedKg, locale)} {kgUnit}
                        </td>

                        <td
                          className={`px-5 py-3.5 text-right text-[12.5px] font-semibold tabular-nums ${
                            available < 0 ? "text-rose-600" : "text-slate-900"
                          }`}
                        >
                          {formatKg(row.availableKg, locale)} {kgUnit}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* <1024px: one card per batch + warehouse — no horizontal scroll. */}
            <ul className="divide-y divide-slate-100 lg:hidden">
              {rows.map((row) => {
                const available = Number(row.availableKg);

                return (
                  <li key={`${row.batchId}:${row.warehouseId}`} className="px-4 py-3">
                    <div className="truncate text-[13px] font-medium text-slate-900">{row.productName}</div>
                    <div className="mt-0.5 text-[11.5px] text-slate-400">
                      {row.productSku} · {labels.batch} {row.batchNumber}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-slate-500">
                      {labels.warehouse}: {row.warehouseName} ({row.warehouseCode})
                    </div>

                    <dl className="mt-2.5 grid grid-cols-3 gap-x-3">
                      <div className="min-w-0">
                        <dt className="text-[11px] text-slate-400">{labels.physical}</dt>
                        <dd className="text-[12.5px] tabular-nums text-slate-700">
                          {formatKg(row.onHandKg, locale)} {kgUnit}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[11px] text-slate-400">{labels.reserved}</dt>
                        <dd className="text-[12.5px] tabular-nums text-slate-700">
                          {formatKg(row.activeReservedKg, locale)} {kgUnit}
                        </dd>
                      </div>
                      <div className="min-w-0 text-right">
                        <dt className="text-[11px] text-slate-400">{labels.available}</dt>
                        <dd
                          className={`text-[12.5px] font-semibold tabular-nums ${
                            available < 0 ? "text-rose-600" : "text-slate-900"
                          }`}
                        >
                          {formatKg(row.availableKg, locale)} {kgUnit}
                        </dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
