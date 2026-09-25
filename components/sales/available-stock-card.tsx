import { Boxes } from "lucide-react";

import { OperationsCard } from "@/components/dashboard/operations/operations-card";
import { AvailableStockList } from "@/components/sales/available-stock-list";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ProductStockAvailability } from "@/lib/services/sales/get-stock-availability";

export function AvailableStockCard({
  stock,
  locale,
  dictionary,
  className,
}: {
  stock: ProductStockAvailability[];
  locale: Locale;
  dictionary: Dictionary;
  className?: string;
}) {
  return (
    <OperationsCard title={dictionary.sales.availableStock.title} className={className}>
      {stock.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-6 text-center">
          <Boxes className="h-5 w-5 text-slate-300 xl:h-4 xl:w-4" strokeWidth={1.75} />
          <p className="text-[12.5px] font-medium text-slate-500 xl:text-[12px]">
            {dictionary.sales.availableStock.empty}
          </p>
        </div>
      ) : (
        <AvailableStockList
          stock={stock}
          locale={locale}
          labels={{
            reservedLabel: dictionary.sales.availableStock.reservedLabel,
            kgUnit: dictionary.common.kgUnit,
            showAll: dictionary.sales.availableStock.showAll,
            collapse: dictionary.sales.availableStock.collapse,
          }}
        />
      )}
    </OperationsCard>
  );
}
