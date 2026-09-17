"use client";

import { Trash2 } from "lucide-react";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { SearchableSelect } from "@/components/sales/order-form/searchable-select";
import { formatPreviewNumber } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { NewOrderFormProduct } from "@/lib/services/sales/get-new-order-form-options";
import type { CreateSalesOrderFormValues } from "@/lib/validation/sales-order";
import { cn } from "@/lib/utils";

type OrderFormItemRowProps = {
  index: number;
  products: NewOrderFormProduct[];
  onRemove: () => void;
  canRemove: boolean;
  locale: Locale;
  dictionary: Dictionary["orderForm"];
};

/**
 * Display-only preview — never sent to the server. Plain JS number math is
 * fine here specifically because this value never leaves the browser as
 * an authoritative figure; createSalesOrder always recomputes the real
 * total from the validated Decimal strings.
 */
function computeDisplayLineTotal(quantityKg: string, pricePerKg: string): number {
  const quantity = Number(quantityKg);
  const price = Number(pricePerKg);
  if (!Number.isFinite(quantity) || !Number.isFinite(price)) return 0;
  return quantity * price;
}

/**
 * text-base md:text-[13px] (not a fixed text-[13px]): these are the only
 * two plain numeric <input>s a user can manually tap into on this page.
 * Below 16px, iOS Safari auto-zooms the visual viewport on focus — this
 * keeps the computed font-size at exactly 16px on mobile to prevent that,
 * while md+ (desktop) keeps the approved 13px appearance unchanged.
 */
const fieldClassName =
  "h-9 w-full rounded-lg border border-slate-200/70 bg-white px-2.5 text-base text-slate-700 transition-colors focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10 focus:outline-none md:text-[13px]";

/**
 * >=1024px: a compact grid row (Product / Quantity / Price / Line total /
 * Remove). <1024px: the same fields stacked as a card — no horizontal
 * overflow at any width, matching the rest of the approved SALES shell.
 * errors.*.message text comes from lib/validation/sales-order.ts's Zod
 * schema and stays English in this stage (see the final report).
 */
export function OrderFormItemRow({
  index,
  products,
  onRemove,
  canRemove,
  locale,
  dictionary,
}: OrderFormItemRowProps) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<CreateSalesOrderFormValues>();

  const { field: productField } = useController({
    control,
    name: `items.${index}.productId` as const,
  });

  const quantityKg = useWatch({ control, name: `items.${index}.quantityKg` }) ?? "";
  const pricePerKg = useWatch({ control, name: `items.${index}.pricePerKg` }) ?? "";
  const lineTotal = computeDisplayLineTotal(quantityKg, pricePerKg);

  const itemErrors = errors.items?.[index];

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-100 p-3 lg:grid lg:grid-cols-[1fr_120px_120px_110px_36px] lg:items-start lg:gap-2 lg:p-2.5">
      <div className="min-w-0">
        <SearchableSelect
          aria-label={dictionary.product}
          value={productField.value}
          onValueChange={productField.onChange}
          onBlur={productField.onBlur}
          options={products.map((product) => ({
            value: product.id,
            label: `${product.name} (${product.sku})`,
          }))}
          placeholder={dictionary.selectProduct}
          error={!!itemErrors?.productId}
        />
        {itemErrors?.productId ? (
          <p className="mt-1 text-[11.5px] text-rose-600">{itemErrors.productId.message}</p>
        ) : null}
      </div>

      <div>
        <input
          type="text"
          inputMode="decimal"
          placeholder={dictionary.quantityPlaceholder}
          aria-label={dictionary.quantityPlaceholder}
          className={cn(fieldClassName, itemErrors?.quantityKg && "border-rose-300")}
          {...register(`items.${index}.quantityKg` as const)}
        />
        {itemErrors?.quantityKg ? (
          <p className="mt-1 text-[11.5px] text-rose-600">{itemErrors.quantityKg.message}</p>
        ) : null}
      </div>

      <div>
        <input
          type="text"
          inputMode="decimal"
          placeholder={dictionary.pricePlaceholder}
          aria-label={dictionary.pricePlaceholder}
          className={cn(fieldClassName, itemErrors?.pricePerKg && "border-rose-300")}
          {...register(`items.${index}.pricePerKg` as const)}
        />
        {itemErrors?.pricePerKg ? (
          <p className="mt-1 text-[11.5px] text-rose-600">{itemErrors.pricePerKg.message}</p>
        ) : null}
      </div>

      <div className="flex h-9 items-center justify-between gap-2 lg:justify-end">
        <span className="text-[11.5px] text-slate-400 lg:hidden">{dictionary.lineTotalMobileLabel}</span>
        <span className="truncate text-[13px] font-semibold text-slate-900">
          {formatPreviewNumber(lineTotal, locale)}
        </span>
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={dictionary.removeItemAriaLabel}
        className="flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:pointer-events-none disabled:opacity-30 lg:self-auto"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
