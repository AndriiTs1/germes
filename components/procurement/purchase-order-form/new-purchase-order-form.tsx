"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Controller, FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { createPurchaseOrderAction } from "@/app/procurement/orders/new/actions";
import { PurchaseOrderItemRow } from "@/components/procurement/purchase-order-form/purchase-order-item-row";
import { SearchableSelect } from "@/components/sales/order-form/searchable-select";
import { DateInput } from "@/components/ui/date-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { resolveFieldError } from "@/lib/i18n/resolve-field-error";
import type {
  NewPurchaseOrderFormProduct,
  NewPurchaseOrderFormSupplier,
  NewPurchaseOrderFormWarehouse,
} from "@/lib/services/procurement/get-new-purchase-order-form-options";
import {
  createPurchaseOrderSchema,
  PURCHASE_ORDER_CURRENCIES,
  type CreatePurchaseOrderFormValues,
  type PurchaseOrderItemFormValues,
} from "@/lib/validation/purchase-order";

type NewPurchaseOrderFormProps = {
  suppliers: NewPurchaseOrderFormSupplier[];
  warehouses: NewPurchaseOrderFormWarehouse[];
  products: NewPurchaseOrderFormProduct[];
  locale: Locale;
  dictionary: Dictionary["procurement"]["orderForm"];
};

const EMPTY_ITEM: PurchaseOrderItemFormValues = { productId: "", quantityKg: "", pricePerKg: "" };

/**
 * Select-internal value for "no destination warehouse". The shared Select
 * treats "" as "nothing selected", so the explicit choice gets its own
 * value here and is mapped back to "" in form state (which the schema
 * turns into undefined). Never sent to the server.
 */
const NO_WAREHOUSE = "__none__";

const cardClassName =
  "rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06)]";

const sectionTitleClassName = "text-[13.5px] font-semibold tracking-tight text-slate-900";

const labelClassName = "text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase";

const errorClassName = "mt-1 text-[11.5px] text-rose-600";

/**
 * Creates a DRAFT PurchaseOrder only. Every field is a raw string in form
 * state; createPurchaseOrderSchema (client resolver + again inside the
 * Action) is the only validation. No totals are previewed here — price is
 * optional in a DRAFT and the exact amounts are shown on the detail page
 * the Action redirects to.
 */
export function NewPurchaseOrderForm({
  suppliers,
  warehouses,
  products,
  locale,
  dictionary,
}: NewPurchaseOrderFormProps) {
  const methods = useForm<CreatePurchaseOrderFormValues>({
    resolver: zodResolver(createPurchaseOrderSchema),
    defaultValues: {
      supplierId: "",
      destinationWarehouseId: "",
      currency: "",
      expectedArrivalDate: "",
      notes: "",
      items: [EMPTY_ITEM],
    },
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = methods;

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = useWatch({ control, name: "items" }) ?? [];

  const supplierOptions = suppliers.map((supplier) => ({
    value: supplier.id,
    label: `${supplier.name} (${supplier.code})`,
  }));

  // Only the allowed codes; the stored form value is the code, never the label.
  const currencyOptions = PURCHASE_ORDER_CURRENCIES.map((code) => ({
    value: code,
    label: dictionary.currencyOptions[code],
  }));

  const warehouseOptions = [
    { value: NO_WAREHOUSE, label: dictionary.noWarehouse },
    ...warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name })),
  ];

  const allProductOptions = products.map((product) => ({
    value: product.id,
    label: `${product.name} (${product.sku})`,
  }));

  /** Products chosen in other rows are hidden; the row's own selection always stays available. */
  function productOptionsForRow(index: number) {
    const takenElsewhere = new Set(
      watchedItems
        .filter((_, otherIndex) => otherIndex !== index)
        .map((item) => item?.productId)
        .filter((productId): productId is string => !!productId),
    );
    return allProductOptions.filter((option) => !takenElsewhere.has(option.value));
  }

  const itemsRootError = resolveFieldError(
    dictionary.errors,
    errors.items?.root?.message ?? errors.items?.message,
  );

  async function onSubmit(data: CreatePurchaseOrderFormValues) {
    const result = await createPurchaseOrderAction(data);
    if (result?.error) {
      toast.error(result.error);
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className={cardClassName}>
          <h2 className={sectionTitleClassName}>{dictionary.detailsTitle}</h2>

          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <label htmlFor="supplierId" className={labelClassName}>
                {dictionary.supplier}
              </label>
              <Controller
                control={control}
                name="supplierId"
                render={({ field }) => (
                  <div className="mt-1">
                    <SearchableSelect
                      id="supplierId"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      options={supplierOptions}
                      placeholder={dictionary.selectSupplier}
                      emptyMessage={dictionary.noOptions}
                      error={!!errors.supplierId}
                    />
                  </div>
                )}
              />
              {errors.supplierId ? (
                <p className={errorClassName}>{resolveFieldError(dictionary.errors, errors.supplierId.message)}</p>
              ) : null}
            </div>

            <div className="min-w-0">
              <label htmlFor="destinationWarehouseId" className={labelClassName}>
                {dictionary.destinationWarehouse}
              </label>
              <Controller
                control={control}
                name="destinationWarehouseId"
                render={({ field }) => (
                  <div className="mt-1">
                    <Select
                      id="destinationWarehouseId"
                      value={field.value ? field.value : NO_WAREHOUSE}
                      onValueChange={(next) => field.onChange(next === NO_WAREHOUSE ? "" : next)}
                      onBlur={field.onBlur}
                      options={warehouseOptions}
                      emptyMessage={dictionary.noOptions}
                      error={!!errors.destinationWarehouseId}
                    />
                  </div>
                )}
              />
              {errors.destinationWarehouseId ? (
                <p className={errorClassName}>
                  {resolveFieldError(dictionary.errors, errors.destinationWarehouseId.message)}
                </p>
              ) : null}
            </div>

            <div className="min-w-0">
              <label htmlFor="currency" className={labelClassName}>
                {dictionary.currency}
              </label>
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <div className="mt-1">
                    <Select
                      id="currency"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      options={currencyOptions}
                      placeholder={dictionary.selectCurrency}
                      emptyMessage={dictionary.noOptions}
                      error={!!errors.currency}
                    />
                  </div>
                )}
              />
              {errors.currency ? (
                <p className={errorClassName}>{resolveFieldError(dictionary.errors, errors.currency.message)}</p>
              ) : null}
            </div>

            <div className="min-w-0">
              <label htmlFor="expectedArrivalDate" className={labelClassName}>
                {dictionary.expectedArrival}
              </label>
              <Controller
                control={control}
                name="expectedArrivalDate"
                render={({ field }) => (
                  <div className="mt-1">
                    <DateInput
                      id="expectedArrivalDate"
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder={dictionary.selectDate}
                      error={!!errors.expectedArrivalDate}
                      locale={locale}
                      previousMonthLabel={dictionary.previousMonth}
                      nextMonthLabel={dictionary.nextMonth}
                    />
                  </div>
                )}
              />
              {errors.expectedArrivalDate ? (
                <p className={errorClassName}>
                  {resolveFieldError(dictionary.errors, errors.expectedArrivalDate.message)}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className={cardClassName}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={sectionTitleClassName}>{dictionary.itemsTitle}</h2>
            <button
              type="button"
              // shouldFocus: false — same as the Sales form: avoids iOS
              // Safari auto-zoom from focusing the new row's input.
              onClick={() => append(EMPTY_ITEM, { shouldFocus: false })}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
              {dictionary.addItem}
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {fields.map((field, index) => (
              <PurchaseOrderItemRow
                key={field.id}
                index={index}
                productOptions={productOptionsForRow(index)}
                onRemove={() => remove(index)}
                canRemove={fields.length > 1}
                dictionary={dictionary}
              />
            ))}
          </div>

          {itemsRootError ? <p className="mt-2 text-[11.5px] text-rose-600">{itemsRootError}</p> : null}
        </div>

        <div className={cardClassName}>
          <label htmlFor="notes" className={sectionTitleClassName}>
            {dictionary.notesTitle}
          </label>
          <Textarea
            id="notes"
            placeholder={dictionary.notesPlaceholder}
            error={!!errors.notes}
            className="mt-3"
            {...register("notes")}
          />
          {errors.notes ? (
            <p className={errorClassName}>{resolveFieldError(dictionary.errors, errors.notes.message)}</p>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Link
            href="/procurement/orders"
            className="rounded-full border border-slate-200/70 bg-white px-4 py-2 text-center text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            {dictionary.cancel}
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-slate-900 px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
          >
            {isSubmitting ? dictionary.creating : dictionary.createDraft}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
