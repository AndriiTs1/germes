import {
  FinanceStatus,
  Prisma,
} from "@/lib/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  addToCurrencyTotals,
  openOutstanding,
  toCurrencyAmounts,
  type CurrencyAmount,
} from "@/lib/services/finance/outstanding";

const CLOSED_STATUSES = [
  FinanceStatus.PAID,
  FinanceStatus.CANCELLED,
];

const DAY_MS = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 7;
const TOP_DEBTORS_PER_CURRENCY = 5;

export type FinanceAgingBucket =
  | "1-7"
  | "8-30"
  | "31-60"
  | "61-90"
  | "90+";

export type FinanceOwnerTopDebtor = {
  customerId: string;
  customerName: string;
  currency: string;
  outstandingAmount: string;
  overdueAmount: string;
  receivableCount: number;
};

export type FinanceOwnerTopDebtorsGroup = {
  currency: string;
  items: FinanceOwnerTopDebtor[];
};

export type FinanceOwnerAging = {
  bucket: FinanceAgingBucket;
  amounts: CurrencyAmount[];
};

export type FinanceOwnerOverview = {
  receivables: {
    outstanding: CurrencyAmount[];
    overdue: CurrencyAmount[];
    dueNext7Days: CurrencyAmount[];
    openCount: number;
    overdueCount: number;
    dueNext7DaysCount: number;
    customersWithDebt: number;
  };
  payables: {
    outstanding: CurrencyAmount[];
    overdue: CurrencyAmount[];
    dueNext7Days: CurrencyAmount[];
    openCount: number;
    overdueCount: number;
    dueNext7DaysCount: number;
  };
  cashPlan: {
    netNext7Days: CurrencyAmount[];
  };
  topDebtors: FinanceOwnerTopDebtorsGroup[];
  aging: FinanceOwnerAging[];
};

type DebtorBucket = {
  customerId: string;
  customerName: string;
  currency: string;
  outstanding: Prisma.Decimal;
  overdue: Prisma.Decimal;
  receivableCount: number;
};

function agingBucket(
  dueDate: Date,
  now: Date,
): FinanceAgingBucket {
  const days = Math.max(
    1,
    Math.floor(
      (now.getTime() - dueDate.getTime()) / DAY_MS,
    ),
  );

  if (days <= 7) return "1-7";
  if (days <= 30) return "8-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";

  return "90+";
}

export async function getFinanceOwnerOverview(
  now: Date = new Date(),
): Promise<FinanceOwnerOverview> {
  const dueSoonBefore = new Date(
    now.getTime() + DUE_SOON_DAYS * DAY_MS,
  );

  /*
   * Finance OWNER overview deliberately excludes historical PAID/CANCELLED
   * rows at query level. Accounting keeps its full operational ledger.
   */
  const [receivables, payables] = await Promise.all([
    prisma.receivable.findMany({
      where: {
        status: {
          notIn: CLOSED_STATUSES,
        },
      },
      select: {
        id: true,
        customerId: true,
        amount: true,
        paidAmount: true,
        currency: true,
        dueDate: true,
        status: true,
        customer: {
          select: {
            name: true,
          },
        },
      },
    }),

    prisma.payable.findMany({
      where: {
        status: {
          notIn: CLOSED_STATUSES,
        },
      },
      select: {
        id: true,
        amount: true,
        paidAmount: true,
        currency: true,
        dueDate: true,
        status: true,
      },
    }),
  ]);

  const receivableOutstanding =
    new Map<string, Prisma.Decimal>();

  const receivableOverdue =
    new Map<string, Prisma.Decimal>();

  const receivableDueSoon =
    new Map<string, Prisma.Decimal>();

  const payableOutstanding =
    new Map<string, Prisma.Decimal>();

  const payableOverdue =
    new Map<string, Prisma.Decimal>();

  const payableDueSoon =
    new Map<string, Prisma.Decimal>();

  const aging = new Map<
    FinanceAgingBucket,
    Map<string, Prisma.Decimal>
  >([
    ["1-7", new Map()],
    ["8-30", new Map()],
    ["31-60", new Map()],
    ["61-90", new Map()],
    ["90+", new Map()],
  ]);

  const debtorBuckets = new Map<string, DebtorBucket>();
  const customersWithDebt = new Set<string>();

  let receivableOpenCount = 0;
  let receivableOverdueCount = 0;
  let receivableDueSoonCount = 0;

  for (const receivable of receivables) {
    const outstanding = openOutstanding(receivable);

    if (!outstanding) continue;

    receivableOpenCount += 1;
    customersWithDebt.add(receivable.customerId);

    addToCurrencyTotals(
      receivableOutstanding,
      receivable.currency,
      outstanding,
    );

    const debtorKey =
      `${receivable.customerId}:${receivable.currency}`;

    const debtor =
      debtorBuckets.get(debtorKey) ?? {
        customerId: receivable.customerId,
        customerName: receivable.customer.name,
        currency: receivable.currency,
        outstanding: new Prisma.Decimal(0),
        overdue: new Prisma.Decimal(0),
        receivableCount: 0,
      };

    debtor.outstanding =
      debtor.outstanding.plus(outstanding);

    debtor.receivableCount += 1;

    if (
      receivable.dueDate !== null &&
      receivable.dueDate.getTime() < now.getTime()
    ) {
      receivableOverdueCount += 1;

      addToCurrencyTotals(
        receivableOverdue,
        receivable.currency,
        outstanding,
      );

      debtor.overdue =
        debtor.overdue.plus(outstanding);

      addToCurrencyTotals(
        aging.get(
          agingBucket(receivable.dueDate, now),
        )!,
        receivable.currency,
        outstanding,
      );
    } else if (
      receivable.dueDate !== null &&
      receivable.dueDate.getTime() >= now.getTime() &&
      receivable.dueDate.getTime() <=
        dueSoonBefore.getTime()
    ) {
      receivableDueSoonCount += 1;

      addToCurrencyTotals(
        receivableDueSoon,
        receivable.currency,
        outstanding,
      );
    }

    debtorBuckets.set(debtorKey, debtor);
  }

  let payableOpenCount = 0;
  let payableOverdueCount = 0;
  let payableDueSoonCount = 0;

  for (const payable of payables) {
    const outstanding = openOutstanding(payable);

    if (!outstanding) continue;

    payableOpenCount += 1;

    addToCurrencyTotals(
      payableOutstanding,
      payable.currency,
      outstanding,
    );

    if (
      payable.dueDate !== null &&
      payable.dueDate.getTime() < now.getTime()
    ) {
      payableOverdueCount += 1;

      addToCurrencyTotals(
        payableOverdue,
        payable.currency,
        outstanding,
      );
    } else if (
      payable.dueDate !== null &&
      payable.dueDate.getTime() >= now.getTime() &&
      payable.dueDate.getTime() <=
        dueSoonBefore.getTime()
    ) {
      payableDueSoonCount += 1;

      addToCurrencyTotals(
        payableDueSoon,
        payable.currency,
        outstanding,
      );
    }
  }

  const netNext7Days =
    new Map<string, Prisma.Decimal>();

  for (const [currency, amount] of receivableDueSoon) {
    addToCurrencyTotals(
      netNext7Days,
      currency,
      amount,
    );
  }

  for (const [currency, amount] of payableDueSoon) {
    addToCurrencyTotals(
      netNext7Days,
      currency,
      amount.negated(),
    );
  }

  const netNext7DaysAmounts =
    toCurrencyAmounts(netNext7Days).filter(
      ({ amount }) =>
        !new Prisma.Decimal(amount).eq(0),
    );

  const debtorGroups = new Map<string, DebtorBucket[]>();

  for (const debtor of debtorBuckets.values()) {
    const rows =
      debtorGroups.get(debtor.currency) ?? [];

    rows.push(debtor);
    debtorGroups.set(debtor.currency, rows);
  }

  const topDebtors: FinanceOwnerTopDebtorsGroup[] =
    [...debtorGroups.entries()]
      .sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0,
      )
      .map(([currency, rows]) => ({
        currency,
        items: rows
          .sort(
            (a, b) =>
              b.outstanding.comparedTo(
                a.outstanding,
              ) ||
              a.customerName.localeCompare(
                b.customerName,
              ) ||
              a.customerId.localeCompare(
                b.customerId,
              ),
          )
          .slice(0, TOP_DEBTORS_PER_CURRENCY)
          .map((row) => ({
            customerId: row.customerId,
            customerName: row.customerName,
            currency: row.currency,
            outstandingAmount:
              row.outstanding.toString(),
            overdueAmount:
              row.overdue.toString(),
            receivableCount:
              row.receivableCount,
          })),
      }));

  const agingResult: FinanceOwnerAging[] = (
    [
      "1-7",
      "8-30",
      "31-60",
      "61-90",
      "90+",
    ] as const
  ).map((bucket) => ({
    bucket,
    amounts: toCurrencyAmounts(
      aging.get(bucket)!,
    ),
  }));

  return {
    receivables: {
      outstanding: toCurrencyAmounts(
        receivableOutstanding,
      ),
      overdue: toCurrencyAmounts(
        receivableOverdue,
      ),
      dueNext7Days: toCurrencyAmounts(
        receivableDueSoon,
      ),
      openCount: receivableOpenCount,
      overdueCount: receivableOverdueCount,
      dueNext7DaysCount:
        receivableDueSoonCount,
      customersWithDebt:
        customersWithDebt.size,
    },

    payables: {
      outstanding: toCurrencyAmounts(
        payableOutstanding,
      ),
      overdue: toCurrencyAmounts(
        payableOverdue,
      ),
      dueNext7Days: toCurrencyAmounts(
        payableDueSoon,
      ),
      openCount: payableOpenCount,
      overdueCount: payableOverdueCount,
      dueNext7DaysCount:
        payableDueSoonCount,
    },

    cashPlan: {
      netNext7Days: netNext7DaysAmounts,
    },

    topDebtors,

    aging: agingResult,
  };
}
