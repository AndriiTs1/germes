import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  addToCurrencyTotals,
  openOutstanding,
  overdueOutstanding,
  toCurrencyAmounts,
  type CurrencyAmount,
} from "@/lib/services/finance/outstanding";

export type CommandCenterKpis = {
  /** Placeholder: no bank/cash model exists yet, so no currency either. */
  cashBanks: {
    value: string;
  };
  /** Kept for callers; its currency is the last order's and must not label other KPIs. */
  salesTurnover: {
    value: string;
    currency: string;
  };
  receivables: {
    /** Open balances per currency (empty = none); never summed across currencies. */
    outstanding: CurrencyAmount[];
    /** The overdue part of those balances, per currency. */
    overdueOutstanding: CurrencyAmount[];
  };
  payables: {
    /** Open balances per currency (empty = none); never summed across currencies. */
    outstanding: CurrencyAmount[];
  };
  /** Σ receivedKg × unitCost. Batch.unitCost has no currency, so none is claimed here. */
  inventoryValue: {
    value: string;
  };
  grossMargin: {
    value: string;
    percent: string;
  };
};

/**
 * Receivable/payable balances are open balances only (openOutstanding: not
 * PAID/CANCELLED, amount - paidAmount > 0), grouped by each record's own
 * currency — no conversion, no cross-currency sum. Overdue = open balance
 * with dueDate strictly before `now`.
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

  const receivableOutstanding = new Map<string, Prisma.Decimal>();
  const overdueReceivable = new Map<string, Prisma.Decimal>();

  for (const receivable of receivables) {
    const outstanding = openOutstanding(receivable);
    if (outstanding) {
      addToCurrencyTotals(receivableOutstanding, receivable.currency, outstanding);
    }

    const overdue = overdueOutstanding(receivable, now);
    if (overdue) {
      addToCurrencyTotals(overdueReceivable, receivable.currency, overdue);
    }
  }

  const payables = await prisma.payable.findMany({
    select: {
      amount: true,
      paidAmount: true,
      currency: true,
      status: true,
    },
  });

  const payableOutstanding = new Map<string, Prisma.Decimal>();

  for (const payable of payables) {
    const outstanding = openOutstanding(payable);
    if (outstanding) {
      addToCurrencyTotals(payableOutstanding, payable.currency, outstanding);
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
    },

    salesTurnover: {
      value: turnover.toString(),
      currency,
    },

    receivables: {
      outstanding: toCurrencyAmounts(receivableOutstanding),
      overdueOutstanding: toCurrencyAmounts(overdueReceivable),
    },

    payables: {
      outstanding: toCurrencyAmounts(payableOutstanding),
    },

    inventoryValue: {
      value: inventoryValue.toString(),
    },

    grossMargin: {
      value: grossProfit.toString(),
      percent: grossMargin.toString(),
    },
  };
}
