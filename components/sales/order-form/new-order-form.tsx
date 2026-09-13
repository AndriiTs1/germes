"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Controller, FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { createSalesOrderAction } from "@/app/sales/orders/new/actions";
import { OrderFormItemRow } from "@/components/sales/order-form/order-form-item-row";
import { SearchableSelect } from "@/components/sales/order-form/searchable-select";
import type {
  NewOrderFormCustomer,
  NewOrderFormProduct,
} from "@/lib/services/sales/get-new-order-form-options";
import {
  createSalesOrderSchema,
  type CreateSalesOrderFormValues,
} from "@/lib/validation/sales-order";
import { cn } from "@/lib/utils";

type NewOrderFormProps = {
  customers: NewOrderFormCustomer[];
  products: NewOrderFormProduct[];
  initialCustomerId?: string;
};

const EMPTY_ITEM = { productId: "", quantityKg: "", pricePerKg: "" };

const cardClassName =
  "rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06)]";

const fieldClassName =
  "mt-1 h-9 w-full rounded-lg border border-slate-200/70 bg-white px-2.5 text-[13px] text-slate-700 transition-colors focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10 focus:outline-none";

const labelClassName = "text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase";

/** Display-only preview total — never sent to the server; see order-form-item-row.tsx's doc comment for why plain number math is safe only here. */
function computeDisplayOrderTotal(items: { quantityKg: string; pricePerKg: string }[]): number {
  return items.reduce((sum, item) => {
    const quantity = Number(item.quantityKg);
    const price = Number(item.pricePerKg);
    if (!Number.isFinite(quantity) || !Number.isFinite(price)) return sum;
    return sum + quantity * price;
  }, 0);
}

export function NewOrderForm({ customers, products, initialCustomerId }: NewOrderFormProps) {
  const methods = useForm<CreateSalesOrderFormValues>({
    resolver: zodResolver(createSalesOrderSchema),
    defaultValues: {
      customerId: initialCustomerId ?? "",
      requestedDate: "",
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
  const orderTotal = computeDisplayOrderTotal(watchedItems);
  const itemsRootError = errors.items?.root?.message ?? errors.items?.message;

  async function onSubmit(data: CreateSalesOrderFormValues) {
    const result = await createSalesOrderAction(data);
    if (result?.error) {
      toast.error(result.error);
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className={cardClassName}>
          <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
            <div>
              <label htmlFor="customerId" className={labelClassName}>
                Customer
              </label>
              <Controller
                control={control}
                name="customerId"
                render={({ field }) => (
                  <div className="mt-1">
                    <SearchableSelect
                      id="customerId"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      options={customers.map((customer) => ({
                        value: customer.id,
                        label: `${customer.name} (${customer.code})`,
                      }))}
                      placeholder="Select a customer"
                      error={!!errors.customerId}
                    />
                  </div>
                )}
              />
              {errors.customerId ? (
                <p className="mt-1 text-[11.5px] text-rose-600">{errors.customerId.message}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="requestedDate" className={labelClassName}>
                Requested date
              </label>
              <input
                id="requestedDate"
                type="date"
                className={fieldClassName}
                {...register("requestedDate")}
              />
              {errors.requestedDate ? (
                <p className="mt-1 text-[11.5px] text-rose-600">{errors.requestedDate.message}</p>
              ) : null}
            </div>

            <div>
              <span className={labelClassName}>Currency</span>
              <p className="mt-1 flex h-9 items-center text-[13px] font-medium text-slate-700">
                UAH
              </p>
            </div>

            <div className="min-[640px]:col-span-2 min-[1024px]:col-span-1">
              <label htmlFor="notes" className={labelClassName}>
                Notes
              </label>
              <input
                id="notes"
                type="text"
                placeholder="Optional"
                className={fieldClassName}
                {...register("notes")}
              />
              {errors.notes ? (
                <p className="mt-1 text-[11.5px] text-rose-600">{errors.notes.message}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className={cardClassName}>
          <div className="flex items-center justify-between">
            <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900">Items</h2>
            <button
              type="button"
              // shouldFocus: false — RHF's default auto-focuses the new
              // row's quantityKg input, which on iOS Safari triggers a
              // visual-viewport auto-zoom (any focused input under 16px
              // font-size does this); the user should pick a product
              // first anyway, not land in Quantity.
              onClick={() => append(EMPTY_ITEM, { shouldFocus: false })}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
              Add item
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {fields.map((field, index) => (
              <OrderFormItemRow
                key={field.id}
                index={index}
                products={products}
                onRemove={() => remove(index)}
                canRemove={fields.length > 1}
              />
            ))}
          </div>

          {itemsRootError ? (
            <p className="mt-2 text-[11.5px] text-rose-600">{itemsRootError}</p>
          ) : null}
        </div>

        <div className={cn(cardClassName, "flex items-center justify-between")}>
          <div>
            <p className={labelClassName}>Order total</p>
            <p className="mt-0.5 text-[18px] font-semibold text-slate-900">
              {orderTotal.toLocaleString("en-US", { maximumFractionDigits: 2 })} UAH
            </p>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-slate-900 px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
          >
            {isSubmitting ? "Creating…" : "Create Order"}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
