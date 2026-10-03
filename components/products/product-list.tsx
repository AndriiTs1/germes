import { Package, SearchX } from "lucide-react";
import Link from "next/link";

import { formatKg } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ProductStockSummary } from "@/lib/services/products/get-product-stock-summaries";
import type { ProductListItem } from "@/lib/services/products/list-products";
import { cn } from "@/lib/utils";

const CARD =
  "rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]";

/** Same colors as the supplier ACTIVE / INACTIVE badges. */
const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-600",
  inactive: "bg-slate-100 text-slate-600",
} as const;

/** Slightly tighter horizontal padding in the compact (md) table, the usual 16px from lg. */
const CELL = "px-3 py-3 lg:px-4";

const isNegative = (value: string) => value.trim().startsWith("-");
const isPositive = (value: string) => Number(value) > 0;

function StatusBadge({ isActive, labels }: { isActive: boolean; labels: Dictionary["products"]["status"] }) {
  const key = isActive ? "active" : "inactive";
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap", STATUS_STYLES[key])}>
      {labels[key]}
    </span>
  );
}

/**
 * Read-only Product master catalog, three layouts, never horizontal scroll:
 *   - >=1024px (lg): full table — SKU | Name | Category | On hand, kg |
 *     Reserved, kg | Available, kg | Status;
 *   - 768–1023px (md): compact table — the category folds under the name,
 *     stock headers use the short labels and every value carries "kg";
 *   - <768px: one card per product.
 * No row links — there is no product detail page yet.
 *
 * Stock is rendered only when `stock` is provided. The page passes it only
 * to users who also hold inventory.stock.read and otherwise never queries
 * it, so products.read alone never reveals any warehouse quantity.
 * Quantities are kilograms (Germes counts stock in quantityKg); a negative
 * available value is bad data and stays visible, highlighted.
 */
export function ProductList({
  products,
  stock,
  hasAnyProducts,
  clearFiltersHref,
  locale,
  dictionary,
}: {
  products: ProductListItem[];
  /** Keyed by product id; null = the viewer may not see stock. */
  stock: Record<string, ProductStockSummary> | null;
  /** False only when the Product table itself is empty. */
  hasAnyProducts: boolean;
  clearFiltersHref: string;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const t = dictionary.products;
  const kg = dictionary.common.kgUnit;

  if (products.length === 0) {
    return (
      <div className={cn(CARD, "flex flex-col items-center justify-center gap-2 px-4 py-12 text-center")}>
        {hasAnyProducts ? (
          <>
            <SearchX className="h-5 w-5 text-slate-300" strokeWidth={1.75} />
            <p className="text-[13px] font-medium text-slate-500">{t.empty.noResults}</p>
            <Link href={clearFiltersHref} className="text-[12.5px] font-medium text-blue-600 hover:text-blue-700">
              {t.empty.clearFilters}
            </Link>
          </>
        ) : (
          <>
            <Package className="h-5 w-5 text-slate-300" strokeWidth={1.75} />
            <p className="text-[13px] font-medium text-slate-500">{t.empty.noProducts}</p>
          </>
        )}
      </div>
    );
  }

  const notSellableHint = (summary: ProductStockSummary) =>
    isPositive(summary.notSellableKg)
      ? t.table.notSellable.replace("{value}", `${formatKg(summary.notSellableKg, locale)} ${kg}`)
      : null;

  // Below lg the stock headers drop their unit, so every value carries it instead.
  const tabletUnit = <span className="ml-1 text-[11px] font-normal text-slate-400 lg:hidden">{kg}</span>;

  return (
    <>
      <div className={cn(CARD, "hidden overflow-hidden md:block")}>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-medium tracking-[0.04em] whitespace-nowrap text-slate-400 uppercase">
              <th scope="col" className={CELL}>
                {t.table.sku}
              </th>
              <th scope="col" className={CELL}>
                {t.table.name}
              </th>
              <th scope="col" className={cn(CELL, "hidden lg:table-cell")}>
                {t.table.category}
              </th>
              {stock ? (
                <>
                  <th scope="col" className={cn(CELL, "text-right")}>
                    <span className="lg:hidden">{t.mobile.onHand}</span>
                    <span className="hidden lg:inline">{t.table.onHand}</span>
                  </th>
                  <th scope="col" className={cn(CELL, "text-right")}>
                    <span className="lg:hidden">{t.mobile.reserved}</span>
                    <span className="hidden lg:inline">{t.table.reserved}</span>
                  </th>
                  <th scope="col" className={cn(CELL, "text-right")}>
                    <span className="lg:hidden">{t.mobile.available}</span>
                    <span className="hidden lg:inline">{t.table.available}</span>
                  </th>
                </>
              ) : null}
              <th scope="col" className={CELL}>
                {t.table.status}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((product) => {
              const summary = stock?.[product.id];
              const hint = summary ? notSellableHint(summary) : null;
              return (
                <tr key={product.id} className="text-[13px]">
                  <td className={cn(CELL, "whitespace-nowrap text-slate-500 tabular-nums")}>{product.sku}</td>
                  <td className={cn(CELL, "lg:max-w-[320px]")}>
                    <p className="font-medium break-words text-slate-900 lg:truncate">{product.name}</p>
                    {/* Below lg the category column is folded into this cell. */}
                    <p className="mt-0.5 text-[11.5px] break-words text-slate-400 lg:hidden">
                      {product.category ?? t.table.categoryNone}
                    </p>
                  </td>
                  <td className={cn(CELL, "hidden whitespace-nowrap lg:table-cell")}>
                    {product.category ? (
                      <span className="text-slate-700">{product.category}</span>
                    ) : (
                      <span className="text-slate-400">{t.table.categoryNone}</span>
                    )}
                  </td>
                  {summary ? (
                    <>
                      <td className={cn(CELL, "text-right whitespace-nowrap text-slate-700 tabular-nums")}>
                        {formatKg(summary.onHandKg, locale)}
                        {tabletUnit}
                        {hint ? <p className="text-[11px] whitespace-normal text-amber-600">{hint}</p> : null}
                      </td>
                      <td className={cn(CELL, "text-right whitespace-nowrap text-slate-700 tabular-nums")}>
                        {formatKg(summary.reservedKg, locale)}
                        {tabletUnit}
                      </td>
                      <td
                        className={cn(
                          CELL,
                          "text-right font-semibold whitespace-nowrap tabular-nums",
                          isNegative(summary.availableKg) ? "text-rose-600" : "text-slate-900",
                        )}
                      >
                        {formatKg(summary.availableKg, locale)}
                        {tabletUnit}
                      </td>
                    </>
                  ) : null}
                  <td className={CELL}>
                    <StatusBadge isActive={product.isActive} labels={t.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {products.map((product) => {
          const summary = stock?.[product.id];
          const hint = summary ? notSellableHint(summary) : null;
          return (
            <li key={product.id} className={cn(CARD, "px-3.5 py-3")}>
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-[13px] leading-5 font-semibold break-words text-slate-900">
                  {product.name}
                </span>
                <StatusBadge isActive={product.isActive} labels={t.status} />
              </div>
              <p className="mt-0.5 truncate text-[11.5px] text-slate-400">
                {product.sku} · {product.category ?? t.table.categoryNone}
              </p>
              {summary ? (
                <>
                  <dl className="mt-3 grid grid-cols-3 gap-x-3 border-t border-slate-100 pt-2.5">
                    <div className="min-w-0">
                      <dt className="truncate text-[10.5px] text-slate-400">{t.mobile.onHand}</dt>
                      <dd className="mt-0.5 truncate text-[12.5px] text-slate-700 tabular-nums">
                        {formatKg(summary.onHandKg, locale)} {kg}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="truncate text-[10.5px] text-slate-400">{t.mobile.reserved}</dt>
                      <dd className="mt-0.5 truncate text-[12.5px] text-slate-700 tabular-nums">
                        {formatKg(summary.reservedKg, locale)} {kg}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="truncate text-[10.5px] text-slate-400">{t.mobile.available}</dt>
                      <dd
                        className={cn(
                          "mt-0.5 truncate text-[12.5px] font-semibold tabular-nums",
                          isNegative(summary.availableKg) ? "text-rose-600" : "text-slate-900",
                        )}
                      >
                        {formatKg(summary.availableKg, locale)} {kg}
                      </dd>
                    </div>
                  </dl>
                  {hint ? <p className="mt-1.5 text-[11px] text-amber-600">{hint}</p> : null}
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
