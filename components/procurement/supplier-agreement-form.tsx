"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { createSupplierAgreementAction } from "@/app/procurement/suppliers/[id]/agreements/new/actions";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Incoterm, PaymentDueBasis } from "@/lib/generated/prisma/enums";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { resolveFieldError } from "@/lib/i18n/resolve-field-error";
import {
  SUPPLIER_AGREEMENT_CURRENCIES,
  supplierAgreementFormSchema,
  type SupplierAgreementFormValues,
} from "@/lib/validation/supplier-agreement";

type FormDictionary = Dictionary["procurement"]["supplierDetail"]["agreementForm"];

/**
 * Select-internal value for "no Incoterm": the shared Select treats "" as
 * "nothing selected", so the explicit choice gets its own value and maps
 * back to "" in form state. Never sent to the server.
 */
const NO_INCOTERM = "__none__";

const EMPTY_VALUES: SupplierAgreementFormValues = {
  agreementNumber: "",
  validFrom: "",
  validTo: "",
  currency: "",
  paymentTermsMode: "none",
  prepaymentPercent: "",
  balanceDueDays: "",
  balanceDueBasis: "",
  paymentTermsNote: "",
  incoterm: "",
  incotermPlace: "",
  defaultLeadTimeDays: "",
  notes: "",
};

const cardClassName =
  "rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06)]";
const sectionTitleClassName = "text-[13.5px] font-semibold tracking-tight text-slate-900";
const labelClassName = "text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase";
const errorClassName = "mt-1 text-[11.5px] text-rose-600";
const hintClassName = "mt-1 text-[11.5px] text-slate-400";

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  return message ? (
    <p id={id} className={errorClassName}>
      {message}
    </p>
  ) : null;
}

/**
 * Creates a DRAFT SupplierAgreement (terms only — no products or prices
 * yet). Every field is a raw string in form state; supplierAgreementFormSchema
 * validates on the client and again inside the Action, which is
 * authoritative. The form never holds status, supplier, author or the
 * Incoterms edition: those are server-owned.
 */
export function SupplierAgreementForm({
  supplierId,
  locale,
  dictionary,
}: {
  supplierId: string;
  locale: Locale;
  dictionary: FormDictionary;
}) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SupplierAgreementFormValues>({
    // raw: submit the form's own string values — the Action re-parses them.
    resolver: zodResolver(supplierAgreementFormSchema, undefined, { raw: true }),
    defaultValues: EMPTY_VALUES,
  });

  const paymentTermsMode = useWatch({ control, name: "paymentTermsMode" });
  const prepaymentPercent = useWatch({ control, name: "prepaymentPercent" });
  const incoterm = useWatch({ control, name: "incoterm" });

  const structured = paymentTermsMode === "structured";
  const prepaymentText = prepaymentPercent.trim();
  const prepaymentNumber = /^\d{1,3}$/.test(prepaymentText) ? Number(prepaymentText) : null;
  const showBalance = structured && prepaymentNumber !== 100;
  const balancePercent = prepaymentNumber !== null && prepaymentNumber <= 100 ? 100 - prepaymentNumber : null;

  const t = dictionary;
  const error = (message: string | undefined) => resolveFieldError(t.errors, message);

  const currencyOptions = SUPPLIER_AGREEMENT_CURRENCIES.map((code) => ({ value: code, label: code }));
  const basisOptions = Object.values(PaymentDueBasis).map((basis) => ({ value: basis, label: t.basis[basis] }));
  const incotermOptions = [
    { value: NO_INCOTERM, label: t.incotermNone },
    ...Object.values(Incoterm).map((code) => ({ value: code, label: code })),
  ];

  async function onSubmit(data: SupplierAgreementFormValues) {
    const result = await createSupplierAgreementAction(supplierId, data);
    if (!result) return;
    if (result.field) {
      setError(result.field, { type: "server", message: result.error }, { shouldFocus: true });
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className={cardClassName}>
        <h2 className={sectionTitleClassName}>{t.sections.main}</h2>

        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="min-w-0">
            <label htmlFor="agreementNumber" className={labelClassName}>
              {t.agreementNumber} *
            </label>
            <Input
              id="agreementNumber"
              placeholder={t.agreementNumberPlaceholder}
              autoComplete="off"
              error={!!errors.agreementNumber}
              aria-describedby={errors.agreementNumber ? "agreementNumber-error" : undefined}
              className="mt-1"
              {...register("agreementNumber")}
            />
            <FieldError id="agreementNumber-error" message={error(errors.agreementNumber?.message)} />
          </div>

          <div className="min-w-0">
            <label htmlFor="validFrom" className={labelClassName}>
              {t.validFrom} *
            </label>
            <Controller
              control={control}
              name="validFrom"
              render={({ field }) => (
                <div className="mt-1">
                  <DateInput
                    id="validFrom"
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder={t.selectDate}
                    error={!!errors.validFrom}
                    locale={locale}
                    previousMonthLabel={t.previousMonth}
                    nextMonthLabel={t.nextMonth}
                  />
                </div>
              )}
            />
            <FieldError id="validFrom-error" message={error(errors.validFrom?.message)} />
          </div>

          <div className="min-w-0">
            <label htmlFor="validTo" className={labelClassName}>
              {t.validTo}
            </label>
            <Controller
              control={control}
              name="validTo"
              render={({ field }) => (
                <div className="mt-1">
                  <DateInput
                    id="validTo"
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder={t.selectDate}
                    error={!!errors.validTo}
                    locale={locale}
                    previousMonthLabel={t.previousMonth}
                    nextMonthLabel={t.nextMonth}
                  />
                </div>
              )}
            />
            {errors.validTo ? (
              <FieldError id="validTo-error" message={error(errors.validTo.message)} />
            ) : (
              <p className={hintClassName}>{t.validToHint}</p>
            )}
          </div>

          <div className="min-w-0">
            <label htmlFor="currency" className={labelClassName}>
              {t.currency} *
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
                    placeholder={t.selectCurrency}
                    emptyMessage={t.noOptions}
                    error={!!errors.currency}
                  />
                </div>
              )}
            />
            <FieldError id="currency-error" message={error(errors.currency?.message)} />
          </div>

          <div className="min-w-0">
            <label htmlFor="defaultLeadTimeDays" className={labelClassName}>
              {t.defaultLeadTime}
            </label>
            <Input
              id="defaultLeadTimeDays"
              inputMode="numeric"
              autoComplete="off"
              error={!!errors.defaultLeadTimeDays}
              aria-describedby={errors.defaultLeadTimeDays ? "defaultLeadTimeDays-error" : undefined}
              className="mt-1"
              {...register("defaultLeadTimeDays")}
            />
            <FieldError id="defaultLeadTimeDays-error" message={error(errors.defaultLeadTimeDays?.message)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={cardClassName}>
          <h2 className={sectionTitleClassName}>{t.sections.payment}</h2>

          <fieldset className="mt-3">
            <legend className="sr-only">{t.sections.payment}</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-5">
              <label className="inline-flex items-center gap-2 text-[13px] text-slate-700">
                <input type="radio" value="none" className="h-4 w-4 accent-slate-900" {...register("paymentTermsMode")} />
                {t.paymentTermsNone}
              </label>
              <label className="inline-flex items-center gap-2 text-[13px] text-slate-700">
                <input
                  type="radio"
                  value="structured"
                  className="h-4 w-4 accent-slate-900"
                  {...register("paymentTermsMode")}
                />
                {t.paymentTermsStructured}
              </label>
            </div>
          </fieldset>

          {structured ? (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="prepaymentPercent" className={labelClassName}>
                  {t.prepayment} *
                </label>
                <Input
                  id="prepaymentPercent"
                  inputMode="numeric"
                  autoComplete="off"
                  error={!!errors.prepaymentPercent}
                  aria-describedby={errors.prepaymentPercent ? "prepaymentPercent-error" : undefined}
                  className="mt-1"
                  {...register("prepaymentPercent")}
                />
                <FieldError id="prepaymentPercent-error" message={error(errors.prepaymentPercent?.message)} />
              </div>

              {showBalance ? (
                <>
                  <div className="min-w-0">
                    <p className={labelClassName}>{t.balance}</p>
                    <p className="mt-1 flex h-9 items-center text-[13px] font-medium text-slate-900" aria-live="polite">
                      {balancePercent !== null ? `${balancePercent}%` : "—"}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <label htmlFor="balanceDueDays" className={labelClassName}>
                      {t.balanceDueDays} *
                    </label>
                    <Input
                      id="balanceDueDays"
                      inputMode="numeric"
                      autoComplete="off"
                      error={!!errors.balanceDueDays}
                      aria-describedby={errors.balanceDueDays ? "balanceDueDays-error" : undefined}
                      className="mt-1"
                      {...register("balanceDueDays")}
                    />
                    <FieldError id="balanceDueDays-error" message={error(errors.balanceDueDays?.message)} />
                  </div>

                  <div className="min-w-0">
                    <label htmlFor="balanceDueBasis" className={labelClassName}>
                      {t.balanceDueBasis} *
                    </label>
                    <Controller
                      control={control}
                      name="balanceDueBasis"
                      render={({ field }) => (
                        <div className="mt-1">
                          <Select
                            id="balanceDueBasis"
                            value={field.value}
                            onValueChange={field.onChange}
                            onBlur={field.onBlur}
                            options={basisOptions}
                            placeholder={t.selectBasis}
                            emptyMessage={t.noOptions}
                            error={!!errors.balanceDueBasis}
                          />
                        </div>
                      )}
                    />
                    <FieldError id="balanceDueBasis-error" message={error(errors.balanceDueBasis?.message)} />
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4">
            <label htmlFor="paymentTermsNote" className={labelClassName}>
              {t.paymentTermsNote}
            </label>
            <Textarea
              id="paymentTermsNote"
              placeholder={t.paymentTermsNotePlaceholder}
              error={!!errors.paymentTermsNote}
              aria-describedby={errors.paymentTermsNote ? "paymentTermsNote-error" : undefined}
              className="mt-1"
              {...register("paymentTermsNote")}
            />
            <FieldError id="paymentTermsNote-error" message={error(errors.paymentTermsNote?.message)} />
          </div>
        </div>

        <div className={cardClassName}>
          <h2 className={sectionTitleClassName}>{t.sections.delivery}</h2>

          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="incoterm" className={labelClassName}>
                {t.incoterm}
              </label>
              <Controller
                control={control}
                name="incoterm"
                render={({ field }) => (
                  <div className="mt-1">
                    <Select
                      id="incoterm"
                      value={field.value ? field.value : NO_INCOTERM}
                      onValueChange={(next) => field.onChange(next === NO_INCOTERM ? "" : next)}
                      onBlur={field.onBlur}
                      options={incotermOptions}
                      emptyMessage={t.noOptions}
                      error={!!errors.incoterm}
                    />
                  </div>
                )}
              />
              {errors.incoterm ? (
                <FieldError id="incoterm-error" message={error(errors.incoterm.message)} />
              ) : incoterm ? (
                <p className={hintClassName}>{t.incotermVersion}</p>
              ) : null}
            </div>

            {incoterm ? (
              <div className="min-w-0">
                <label htmlFor="incotermPlace" className={labelClassName}>
                  {t.incotermPlace} *
                </label>
                <Input
                  id="incotermPlace"
                  placeholder={t.incotermPlacePlaceholder}
                  autoComplete="off"
                  error={!!errors.incotermPlace}
                  aria-describedby={errors.incotermPlace ? "incotermPlace-error" : undefined}
                  className="mt-1"
                  {...register("incotermPlace")}
                />
                <FieldError id="incotermPlace-error" message={error(errors.incotermPlace?.message)} />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className={cardClassName}>
        <label htmlFor="notes" className={sectionTitleClassName}>
          {t.sections.notes}
        </label>
        <Textarea
          id="notes"
          placeholder={t.notesPlaceholder}
          error={!!errors.notes}
          aria-describedby={errors.notes ? "notes-error" : undefined}
          className="mt-3"
          {...register("notes")}
        />
        <FieldError id="notes-error" message={error(errors.notes?.message)} />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Link
          href={`/procurement/suppliers/${supplierId}/agreements`}
          className="rounded-full border border-slate-200/70 bg-white px-4 py-2 text-center text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          {t.cancel}
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-slate-900 px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
        >
          {isSubmitting ? t.submitting : t.submit}
        </button>
      </div>
    </form>
  );
}
