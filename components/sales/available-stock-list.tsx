"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";

import { formatKg } from "@/components/sales/format";
import { INTL_LOCALE_MAP, type Locale } from "@/lib/i18n/config";
import type { ProductStockAvailability } from "@/lib/services/sales/get-stock-availability";
import { cn } from "@/lib/utils";

const VISIBLE_LIMIT = 5;

/**
 * Client-only expand/collapse for AvailableStockCard. Every row is already
 * loaded server-side — expanding only reveals hidden rows, it never fetches
 * anything. Receives just the few strings it renders (not the whole
 * Dictionary) to keep the client payload small. Sorted by product name for
 * display only; the service's data and ordering are untouched.
 */
export function AvailableStockList({
  stock,
  locale,
  labels,
}: {
  stock: ProductStockAvailability[];
  locale: Locale;
  labels: {
    reservedLabel: string;
    kgUnit: string;
    showAll: string;
    collapse: string;
  };
}) {
  const [expanded, setExpanded] = useState(false);

  const collator = new Intl.Collator(INTL_LOCALE_MAP[locale]);
  const sorted = [...stock].sort((a, b) => collator.compare(a.name, b.name));
  const visible = expanded ? sorted : sorted.slice(0, VISIBLE_LIMIT);
  const canToggle = sorted.length > VISIBLE_LIMIT;

  return (
    <>
      <ul className="flex flex-1 flex-col gap-1 overflow-y-auto xl:gap-0 xl:divide-y xl:divide-slate-100">
        {visible.map((product) => {
          const isNegative = product.availableKg.trim().startsWith("-");
          const hasInconsistent = product.inconsistentReservedKg !== "0";

          return (
            <li key={product.productId}>
              <div className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-slate-900">
                    {product.name}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">
                    {labels.reservedLabel} {formatKg(product.activeReservedKg, locale)}{" "}
                    {labels.kgUnit}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {hasInconsistent ? (
                    <TriangleAlert
                      className="h-3.5 w-3.5 shrink-0 text-amber-500"
                      strokeWidth={1.75}
                    />
                  ) : null}
                  <span
                    className={cn(
                      "text-[12.5px] font-semibold whitespace-nowrap",
                      isNegative ? "text-rose-600" : "text-slate-900",
                    )}
                  >
                    {formatKg(product.availableKg, locale)} {labels.kgUnit}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {canToggle ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 self-start px-2 text-[12px] font-medium text-blue-600 hover:text-blue-700"
        >
          {expanded ? labels.collapse : labels.showAll.replace("{count}", String(sorted.length))}
        </button>
      ) : null}
    </>
  );
}
