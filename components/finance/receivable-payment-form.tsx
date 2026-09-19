"use client";

import { useActionState } from "react";

import {
  registerFinanceReceivablePaymentAction,
  type RegisterFinancePaymentActionState,
} from "@/app/finance/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

const INITIAL_STATE: RegisterFinancePaymentActionState = {
  ok: false,
  message: null,
};

export function FinanceReceivablePaymentForm({
  receivableId,
  outstandingAmount,
  currency,
  orderLabel,
  dictionary,
}: {
  receivableId: string;
  outstandingAmount: string;
  currency: string;
  orderLabel: string;
  dictionary: Dictionary["finance"]["receivables"];
}) {
  const [state, action, pending] = useActionState(
    registerFinanceReceivablePaymentAction,
    INITIAL_STATE,
  );

  return (
    <form action={action} className="mt-3 max-w-xl border-t border-slate-100 pt-3">
      <input type="hidden" name="receivableId" value={receivableId} />

      <p className="mb-2 text-[11px] font-medium text-slate-500">
        {dictionary.paymentForOrder} {orderLabel}
      </p>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input
          name="amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={dictionary.paymentAmountPlaceholder.replace(
            "{currency}",
            currency,
          )}
          disabled={pending}
          error={Boolean(state.message && !state.ok)}
        />

        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="px-4"
        >
          {pending ? dictionary.registeringPayment : dictionary.registerPayment}
        </Button>
      </div>

      <p className="mt-1.5 text-[11px] text-slate-400">
        {dictionary.outstandingToPay} {outstandingAmount} {currency}
      </p>

      {state.message ? (
        <p
          className={cn(
            "mt-1.5 text-[11px] font-medium",
            state.ok ? "text-emerald-600" : "text-rose-600",
          )}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
