import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { openOutstanding, overdueOutstanding } from "@/lib/services/finance/outstanding";

export type CommandCenterKpis = {
  cashBanks: {
    value: string;
    currency: string;
  };
  salesTurnover: {
    value: string;
    currency: string;
  };
  receivables: {
    total: string;
    outstanding: string;
    currency: string;
  };
  overdueReceivables: {
    total: string;
    currency: string;
  };
  payables: {
    total: string;
    outstanding: string;
    currency: string;
  };
  inventoryValue: {
    value: string;
    currency: string;
  };
  grossMargin: {
    value: string;
    percent: string;
    currency: string;
  };
};

/**
 * `receivables.outstanding` / `payables.outstanding` are the open balances
 * (openOutstanding: not PAID/CANCELLED, amount - paidAmount > 0) and are
 * what the Dashboard shows; `total` stays the raw Σ amount of all records.
 * Overdue receivables = open balance with dueDate strictly before `now`.
 * Currencies are still summed together here (known, separate issue).
 */
export async function getCommandCenterKpis(now: Date = new Date()): Promise<CommandCenterKpis> {
  const orders = await prisma.salesOrder.findMany({
    select: {
      currency: true,
      items: {
        select: {
          quantityKg: true,
          pricePerKg: true,
        },
      },
    },
  });

  let turnover = new Prisma.Decimal(0);
  let currency = "UAH";

  for (const order of orders) {
    currency = order.currency;

    for (const item of order.items) {
      turnover = turnover.plus(
        item.quantityKg.mul(item.pricePerKg),
      );
    }
  }

  const receivables = await prisma.receivable.findMany({
    select: {
      amount: true,
      paidAmount: true,
      currency: true,
      status: true,
      dueDate: true,
    },
  });

  let receivableTotal = new Prisma.Decimal(0);
  let receivableOutstanding = new Prisma.Decimal(0);
  let overdueReceivable = new Prisma.Decimal(0);

  for (const receivable of receivables) {
    receivableTotal = receivableTotal.plus(receivable.amount);

    const outstanding = openOutstanding(receivable);
    if (outstanding) {
      receivableOutstanding = receivableOutstanding.plus(outstanding);
    }

    const overdue = overdueOutstanding(receivable, now);
    if (overdue) {
      overdueReceivable = overdueReceivable.plus(overdue);
    }
  }

  const payables = await prisma.payable.findMany({
    select: {
      amount: true,
      paidAmount: true,
      status: true,
    },
  });

  let payableTotal = new Prisma.Decimal(0);
  let payableOutstanding = new Prisma.Decimal(0);

  for (const payable of payables) {
    payableTotal = payableTotal.plus(payable.amount);

    const outstanding = openOutstanding(payable);
    if (outstanding) {
      payableOutstanding = payableOutstanding.plus(outstanding);
    }
  }

  const batches = await prisma.batch.findMany({
    select: {
      receivedKg: true,
      unitCost: true,
    },
  });

  let inventoryValue = new Prisma.Decimal(0);

  for (const batch of batches) {
    if (batch.receivedKg && batch.unitCost) {
      inventoryValue = inventoryValue.plus(
        batch.receivedKg.mul(batch.unitCost),
      );
    }
  }

  // Gross margin requires real COGS data.
  // Current schema has inventory cost, but not cost of sold items.
  // Do not calculate Revenue - Inventory Value: that would be incorrect.
  const grossProfit = new Prisma.Decimal(0);
  const grossMargin = new Prisma.Decimal(0);

  return {
    cashBanks: {
      value: "0",
      currency,
    },

    salesTurnover: {
      value: turnover.toString(),
      currency,
    },

    receivables: {
      total: receivableTotal.toString(),
      outstanding: receivableOutstanding.toString(),
      currency,
    },

    overdueReceivables: {
      total: overdueReceivable.toString(),
      currency,
    },

    payables: {
      total: payableTotal.toString(),
      outstanding: payableOutstanding.toString(),
      currency,
    },

    inventoryValue: {
      value: inventoryValue.toString(),
      currency,
    },

    grossMargin: {
      value: grossProfit.toString(),
      percent: grossMargin.toString(),
      currency,
    },
  };
}
