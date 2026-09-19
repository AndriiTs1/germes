import { FinanceStatus, Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type FinanceReceivableListItem = {
  id: string;
  customerId: string;
  customerName: string;
  salesOrderId: string | null;
  orderNumber: string | null;
  reference: string | null;
  amount: string;
  paidAmount: string;
  outstandingAmount: string;
  currency: string;
  dueDate: string | null;
  status: FinanceStatus;
  isOverdue: boolean;
  createdAt: string;
};

function decimalToString(value: Prisma.Decimal): string {
  return value.toString();
}

/**
 * Finance-wide receivables list.
 *
 * Unlike Sales read models, this is intentionally not scoped by the sales
 * representative responsible for the customer/order. Authorization belongs
 * to the /finance caller before this service is invoked.
 */
export async function listReceivables(): Promise<FinanceReceivableListItem[]> {
  const receivables = await prisma.receivable.findMany({
    select: {
      id: true,
      amount: true,
      paidAmount: true,
      currency: true,
      dueDate: true,
      status: true,
      reference: true,
      createdAt: true,
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
      salesOrder: {
        select: {
          id: true,
          orderNumber: true,
        },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  const now = new Date();

  return receivables.map((receivable) => {
    const outstanding = receivable.amount.minus(receivable.paidAmount);

    return {
      id: receivable.id,
      customerId: receivable.customer.id,
      customerName: receivable.customer.name,
      salesOrderId: receivable.salesOrder?.id ?? null,
      orderNumber: receivable.salesOrder?.orderNumber ?? null,
      reference: receivable.reference,
      amount: decimalToString(receivable.amount),
      paidAmount: decimalToString(receivable.paidAmount),
      outstandingAmount: decimalToString(outstanding),
      currency: receivable.currency,
      dueDate: receivable.dueDate?.toISOString() ?? null,
      status: receivable.status,
      isOverdue:
        outstanding.greaterThan(0) &&
        receivable.status !== FinanceStatus.CANCELLED &&
        receivable.dueDate !== null &&
        receivable.dueDate.getTime() < now.getTime(),
      createdAt: receivable.createdAt.toISOString(),
    };
  });
}
