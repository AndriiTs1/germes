import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  FinanceStatus,
  Prisma,
} from "@/lib/generated/prisma/client";

type ReceivableRow = {
  id: string;
  customerId: string;
  amount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  currency: string;
  dueDate: Date | null;
  status: FinanceStatus;
  customer: {
    name: string;
  };
};

type PayableRow = {
  id: string;
  amount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  currency: string;
  dueDate: Date | null;
  status: FinanceStatus;
};

const db = vi.hoisted(() => ({
  receivables: [] as ReceivableRow[],
  payables: [] as PayableRow[],
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    receivable: {
      findMany: async () => db.receivables,
    },
    payable: {
      findMany: async () => db.payables,
    },
  },
}));

import { getFinanceOwnerOverview } from "@/lib/services/finance/get-finance-owner-overview";

const NOW =
  new Date("2026-09-28T12:00:00.000Z");

const decimal = (value: string) =>
  new Prisma.Decimal(value);

function receivable(
  id: string,
  customerId: string,
  customerName: string,
  status: FinanceStatus,
  amount: string,
  paidAmount: string,
  currency: string,
  dueDate: string | null,
): ReceivableRow {
  return {
    id,
    customerId,
    amount: decimal(amount),
    paidAmount: decimal(paidAmount),
    currency,
    dueDate:
      dueDate === null
        ? null
        : new Date(dueDate),
    status,
    customer: {
      name: customerName,
    },
  };
}

function payable(
  id: string,
  status: FinanceStatus,
  amount: string,
  paidAmount: string,
  currency: string,
  dueDate: string | null,
): PayableRow {
  return {
    id,
    amount: decimal(amount),
    paidAmount: decimal(paidAmount),
    currency,
    dueDate:
      dueDate === null
        ? null
        : new Date(dueDate),
    status,
  };
}

beforeEach(() => {
  db.receivables = [];
  db.payables = [];
});

describe("getFinanceOwnerOverview", () => {
  it("builds OWNER finance metrics without mixing currencies or closed history", async () => {
    db.receivables = [
      receivable(
        "r1",
        "c1",
        "Alpha",
        FinanceStatus.OPEN,
        "1000",
        "0",
        "UAH",
        "2026-09-26T12:00:00.000Z",
      ),
      receivable(
        "r2",
        "c1",
        "Alpha",
        FinanceStatus.PARTIALLY_PAID,
        "1000",
        "400",
        "UAH",
        "2026-10-01T12:00:00.000Z",
      ),
      receivable(
        "r3",
        "c2",
        "Beta",
        FinanceStatus.OPEN,
        "200",
        "0",
        "EUR",
        "2026-08-19T12:00:00.000Z",
      ),
      receivable(
        "r4",
        "c3",
        "Closed",
        FinanceStatus.PAID,
        "500",
        "500",
        "UAH",
        "2026-09-01T12:00:00.000Z",
      ),
      receivable(
        "r5",
        "c4",
        "Cancelled",
        FinanceStatus.CANCELLED,
        "900",
        "0",
        "UAH",
        "2026-09-01T12:00:00.000Z",
      ),
    ];

    db.payables = [
      payable(
        "p1",
        FinanceStatus.OPEN,
        "800",
        "0",
        "UAH",
        "2026-09-20T12:00:00.000Z",
      ),
      payable(
        "p2",
        FinanceStatus.PARTIALLY_PAID,
        "1000",
        "250",
        "EUR",
        "2026-10-01T12:00:00.000Z",
      ),
      payable(
        "p3",
        FinanceStatus.PAID,
        "700",
        "700",
        "UAH",
        "2026-09-01T12:00:00.000Z",
      ),
    ];

    const overview =
      await getFinanceOwnerOverview(NOW);

    expect(
      overview.receivables.outstanding,
    ).toEqual([
      {
        currency: "EUR",
        amount: "200",
      },
      {
        currency: "UAH",
        amount: "1600",
      },
    ]);

    expect(
      overview.receivables.overdue,
    ).toEqual([
      {
        currency: "EUR",
        amount: "200",
      },
      {
        currency: "UAH",
        amount: "1000",
      },
    ]);

    expect(
      overview.receivables.dueNext7Days,
    ).toEqual([
      {
        currency: "UAH",
        amount: "600",
      },
    ]);

    expect(
      overview.receivables.openCount,
    ).toBe(3);

    expect(
      overview.receivables.overdueCount,
    ).toBe(2);

    expect(
      overview.receivables.dueNext7DaysCount,
    ).toBe(1);

    expect(
      overview.receivables.customersWithDebt,
    ).toBe(2);

    expect(overview.topDebtors).toEqual([
      {
        currency: "EUR",
        items: [
          {
            customerId: "c2",
            customerName: "Beta",
            currency: "EUR",
            outstandingAmount: "200",
            overdueAmount: "200",
            receivableCount: 1,
          },
        ],
      },
      {
        currency: "UAH",
        items: [
          {
            customerId: "c1",
            customerName: "Alpha",
            currency: "UAH",
            outstandingAmount: "1600",
            overdueAmount: "1000",
            receivableCount: 2,
          },
        ],
      },
    ]);

    expect(overview.aging).toEqual([
      {
        bucket: "1-7",
        amounts: [
          {
            currency: "UAH",
            amount: "1000",
          },
        ],
      },
      {
        bucket: "8-30",
        amounts: [],
      },
      {
        bucket: "31-60",
        amounts: [
          {
            currency: "EUR",
            amount: "200",
          },
        ],
      },
      {
        bucket: "61-90",
        amounts: [],
      },
      {
        bucket: "90+",
        amounts: [],
      },
    ]);

    expect(
      overview.payables.outstanding,
    ).toEqual([
      {
        currency: "EUR",
        amount: "750",
      },
      {
        currency: "UAH",
        amount: "800",
      },
    ]);

    expect(
      overview.payables.overdue,
    ).toEqual([
      {
        currency: "UAH",
        amount: "800",
      },
    ]);

    expect(
      overview.payables.dueNext7Days,
    ).toEqual([
      {
        currency: "EUR",
        amount: "750",
      },
    ]);

    expect(
      overview.payables.openCount,
    ).toBe(2);

    expect(
      overview.payables.overdueCount,
    ).toBe(1);

    expect(
      overview.payables.dueNext7DaysCount,
    ).toBe(1);

    expect(
      overview.cashPlan.netNext7Days,
    ).toEqual([
      {
        currency: "EUR",
        amount: "-750",
      },
      {
        currency: "UAH",
        amount: "600",
      },
    ]);
  });
});
