import { prisma } from "@/lib/db/prisma";

export type PaymentCalendarData = {
  day: string;
  monthIndex: number;
  eventType: "supplierPayment" | "taxPayment" | "customerReceipt";
  amount: string;
  status: "overdue" | "neutral" | "positive" | "upcoming";
};

export async function getPaymentCalendar(): Promise<PaymentCalendarData[]> {
  const payables = await prisma.payable.findMany({
    where: {
      status: {
        not: "PAID",
      },
    },
    orderBy: {
      dueDate: "asc",
    },
    take: 5,
  });

  const receivables = await prisma.receivable.findMany({
    where: {
      status: {
        not: "PAID",
      },
    },
    orderBy: {
      dueDate: "asc",
    },
    take: 5,
  });

  const events: PaymentCalendarData[] = [];

  for (const item of payables) {
    if (!item.dueDate) continue;

    events.push({
      day: String(item.dueDate.getDate()),
      monthIndex: item.dueDate.getMonth(),
      eventType: "supplierPayment",
      amount: `${item.amount.toString()} ${item.currency}`,
      status:
        item.status === "OVERDUE"
          ? "overdue"
          : "upcoming",
    });
  }

  for (const item of receivables) {
    if (!item.dueDate) continue;

    events.push({
      day: String(item.dueDate.getDate()),
      monthIndex: item.dueDate.getMonth(),
      eventType: "customerReceipt",
      amount: `${item.amount.toString()} ${item.currency}`,
      status:
        item.status === "OVERDUE"
          ? "overdue"
          : "positive",
    });
  }

  return events
    .sort((a, b) => {
      return (
        a.monthIndex - b.monthIndex ||
        Number(a.day) - Number(b.day)
      );
    })
    .slice(0, 5);
}
