import { AlertTriangle, Boxes } from "lucide-react";

import { formatKg } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { ProductStockAvailability } from "@/lib/services/sales/get-stock-availability";

type WarehouseStockOverviewProps = {
  stock: ProductStockAvailability[];
  locale: Locale;
  kgUnit: string;
};

export function WarehouseStockOverview({
  stock,
  locale,
  kgUnit,
}: WarehouseStockOverviewProps) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <Boxes className="h-4 w-4 text-slate-500" aria-hidden="true" />
        <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900">
          Остатки
        </h2>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]">
        {stock.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-slate-500">
            Пока нет товаров
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200/70 bg-slate-50/70">
                  <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
                    Товар
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
                    Физически
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
                    Зарезервировано
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
                    Доступно
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {stock.map((product) => {
                  const available = Number(product.availableKg);
                  const inconsistent = Number(product.inconsistentReservedKg) !== 0;
                  const requiresAttention = available < 0 || inconsistent;

                  return (
                    <tr key={product.productId} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-slate-900">
                            {product.name}
                          </span>

                          {requiresAttention ? (
                            <span title="Требует проверки складских данных">
                              <AlertTriangle
                                className="h-3.5 w-3.5 text-amber-500"
                                aria-hidden="true"
                              />
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-[12.5px] text-slate-500">
                        {product.sku}
                      </td>

                      <td className="px-4 py-3.5 text-right text-[12.5px] tabular-nums text-slate-700">
                        {formatKg(product.physicalOnHandKg, locale)} {kgUnit}
                      </td>

                      <td className="px-4 py-3.5 text-right text-[12.5px] tabular-nums text-slate-700">
                        {formatKg(product.activeReservedKg, locale)} {kgUnit}
                      </td>

                      <td
                        className={`px-5 py-3.5 text-right text-[12.5px] font-semibold tabular-nums ${
                          available < 0 ? "text-rose-600" : "text-slate-900"
                        }`}
                      >
                        {formatKg(product.availableKg, locale)} {kgUnit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
