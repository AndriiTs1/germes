import { Boxes, TriangleAlert } from "lucide-react";

import { OperationsCard } from "@/components/dashboard/operations/operations-card";
import { formatKg } from "@/components/sales/format";
import type { ProductStockAvailability } from "@/lib/services/sales/get-stock-availability";
import { cn } from "@/lib/utils";

export function AvailableStockCard({
  stock,
  className,
}: {
  stock: ProductStockAvailability[];
  className?: string;
}) {
  return (
    <OperationsCard title="Available Stock" className={className}>
      {stock.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-6 text-center">
          <Boxes className="h-5 w-5 text-slate-300 xl:h-4 xl:w-4" strokeWidth={1.75} />
          <p className="text-[12.5px] font-medium text-slate-500 xl:text-[12px]">
            No products yet
          </p>
        </div>
      ) : (
        <ul className="flex flex-1 flex-col gap-1 overflow-y-auto xl:gap-0 xl:divide-y xl:divide-slate-100">
          {stock.map((product) => {
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
                      Reserved {formatKg(product.activeReservedKg)} kg
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
                      {formatKg(product.availableKg)} kg
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </OperationsCard>
  );
}
