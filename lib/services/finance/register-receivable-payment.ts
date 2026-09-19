import {
  FinanceStatus,
  Prisma,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const MAX_TRANSACTION_ATTEMPTS = 3;

export type RegisterReceivablePaymentInput = {
  receivableId: string;
  /** Decimal(14,2) amount, strictly > 0. */
  amount: string;
};

export type RegisterReceivablePaymentError =
  | "RECEIVABLE_UNAVAILABLE"
  | "INVALID_AMOUNT"
  | "OVERPAYMENT"
  | "UPDATE_FAILED";

export type RegisterReceivablePaymentResult =
  | {
      ok: true;
      receivableId: string;
      paidAmount: string;
      outstandingAmount: string;
      status: FinanceStatus;
    }
  | {
      ok: false;
      error: RegisterReceivablePaymentError;
    };

class ReceivableUnavailableError extends Error {}
class OverpaymentError extends Error {}
class ConcurrentUpdateError extends Error {}

function isTransactionConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

export async function registerReceivablePayment(
  currentUserId: string,
  input: RegisterReceivablePaymentInput,
): Promise<RegisterReceivablePaymentResult> {
  let paymentAmount: Prisma.Decimal;

  try {
    paymentAmount = new Prisma.Decimal(input.amount);
  } catch {
    return { ok: false, error: "INVALID_AMOUNT" };
  }

  if (!paymentAmount.isFinite() || !paymentAmount.gt(0)) {
    return { ok: false, error: "INVALID_AMOUNT" };
  }

  // Receivable values are Decimal(14,2). Do not silently round money input.
  if (paymentAmount.decimalPlaces() > 2) {
    return { ok: false, error: "INVALID_AMOUNT" };
  }

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt++) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const receivable = await tx.receivable.findUnique({
            where: {
              id: input.receivableId,
            },
            select: {
              id: true,
              amount: true,
              paidAmount: true,
              currency: true,
              status: true,
              salesOrderId: true,
              reference: true,
            },
          });

          if (
            !receivable ||
            receivable.status === FinanceStatus.PAID ||
            receivable.status === FinanceStatus.CANCELLED
          ) {
            throw new ReceivableUnavailableError();
          }

          const outstandingAmount = receivable.amount.minus(
            receivable.paidAmount,
          );

          if (!outstandingAmount.gt(0)) {
            throw new ReceivableUnavailableError();
          }

          if (paymentAmount.gt(outstandingAmount)) {
            throw new OverpaymentError();
          }

          const nextPaidAmount = receivable.paidAmount.plus(paymentAmount);
          const nextOutstandingAmount =
            receivable.amount.minus(nextPaidAmount);

          const nextStatus =
            nextOutstandingAmount.eq(0)
              ? FinanceStatus.PAID
              : FinanceStatus.PARTIALLY_PAID;

          // Guard against a stale snapshot if another payment changed this
          // receivable concurrently. SERIALIZABLE + retry then re-reads it.
          const updateResult = await tx.receivable.updateMany({
            where: {
              id: receivable.id,
              paidAmount: receivable.paidAmount,
              status: receivable.status,
            },
            data: {
              paidAmount: nextPaidAmount,
              status: nextStatus,
            },
          });

          if (updateResult.count !== 1) {
            throw new ConcurrentUpdateError();
          }

          await tx.auditLog.create({
            data: {
              actorId: currentUserId,
              entityType: "Receivable",
              entityId: receivable.id,
              action: "REGISTER_PAYMENT",
              metadata: {
                salesOrderId: receivable.salesOrderId,
                reference: receivable.reference,
                currency: receivable.currency,
                paymentAmount: paymentAmount.toString(),
                previousPaidAmount: receivable.paidAmount.toString(),
                paidAmount: nextPaidAmount.toString(),
                outstandingAmount: nextOutstandingAmount.toString(),
                fromStatus: receivable.status,
                toStatus: nextStatus,
              },
            },
          });

          return {
            receivableId: receivable.id,
            paidAmount: nextPaidAmount.toString(),
            outstandingAmount: nextOutstandingAmount.toString(),
            status: nextStatus,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      return {
        ok: true,
        ...result,
      };
    } catch (error) {
      if (error instanceof ReceivableUnavailableError) {
        return { ok: false, error: "RECEIVABLE_UNAVAILABLE" };
      }

      if (error instanceof OverpaymentError) {
        return { ok: false, error: "OVERPAYMENT" };
      }

      if (
        (error instanceof ConcurrentUpdateError ||
          isTransactionConflict(error)) &&
        attempt < MAX_TRANSACTION_ATTEMPTS
      ) {
        continue;
      }

      return { ok: false, error: "UPDATE_FAILED" };
    }
  }

  return { ok: false, error: "UPDATE_FAILED" };
}
