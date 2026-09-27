"use client";

import { Trash2 } from "lucide-react";
import { useController, useFormContext } from "react-hook-form";
import { SearchableSelect, type SearchableSelectOption } from "@/components/sales/order-form/searchable-select";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { resolveFieldError } from "@/lib/i18n/resolve-field-error";
import type { CreatePurchaseOrderFormValues } from "@/lib/validation/purchase-order";
import { cn } from "@/lib/utils";

type PurchaseOrderItemRowProps = {
  index: number;
  /** Already filtered by the parent: products not selected in other rows, plus this row's own selection. */
  productOptions: SearchableSelectOption[];
  onRemove: () => void;
  canRemove: boolean;
  dictionary: Dictionary["procurement"]["orderForm"];
};

/** text-base md:text-[13px]: keeps iOS Safari from auto-zooming on focus — same as the Sales item row. */
const fieldClassName =
  "h-9 w-full rounded-lg border border-slate-200/70 bg-white px-2.5 text-base text-slate-700 transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10 focus:outline-none md:text-[13px]";

/**
 * >=1024px: a compact grid row (Product / Quantity / Price / Remove).
 * <1024px: the same fields stacked as a card. Quantity and price stay the
 * raw strings the user typed — no Number()/parseFloat, no line total; the
 * authoritative amounts are computed server-side with Prisma.Decimal.
 * Price is optional in a DRAFT.
 */
export function PurchaseOrderItemRow({
  index,
  productOptions,
  onRemove,
  canRemove,
  dictionary,
}: PurchaseOrderItemRowProps) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<CreatePurchaseOrderFormValues>();

  const { field: productField } = useController({
    control,
    name: `items.${index}.productId` as const,
  });

  const itemErrors = errors.items?.[index];

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-100 p-3 lg:grid lg:grid-cols-[1fr_140px_140px_36px] lg:items-start lg:gap-2 lg:p-2.5">
      <div className="min-w-0">
        <SearchableSelect
          aria-label={dictionary.product}
          value={productField.value}
          onValueChange={productField.onChange}
          onBlur={productField.onBlur}
          options={productOptions}
          placeholder={dictionary.selectProduct}
          emptyMessage={dictionary.noOptions}
          error={!!itemErrors?.productId}
        />
        {itemErrors?.productId ? (
          <p className="mt-1 text-[11.5px] text-rose-600">
            {resolveFieldError(dictionary.errors, itemErrors.productId.message)}
          </p>
        ) : null}
      </div>

      <div>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={dictionary.quantityPlaceholder}
          aria-label={dictionary.quantityPlaceholder}
          className={cn(fieldClassName, itemErrors?.quantityKg && "border-rose-300")}
          {...register(`items.${index}.quantityKg` as const)}
        />
        {itemErrors?.quantityKg ? (
          <p className="mt-1 text-[11.5px] text-rose-600">
            {resolveFieldError(dictionary.errors, itemErrors.quantityKg.message)}
          </p>
        ) : null}
      </div>

      <div>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={dictionary.pricePlaceholder}
          aria-label={dictionary.pricePlaceholder}
          className={cn(fieldClassName, itemErrors?.pricePerKg && "border-rose-300")}
          {...register(`items.${index}.pricePerKg` as const)}
        />
        {itemErrors?.pricePerKg ? (
          <p className="mt-1 text-[11.5px] text-rose-600">
            {resolveFieldError(dictionary.errors, itemErrors.pricePerKg.message)}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={dictionary.removeItemAriaLabel}
        className="flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:pointer-events-none disabled:opacity-30 lg:self-auto"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
