import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/lib/generated/prisma/client";

type Row = {
  amount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  status: string;
  currency: string;
  dueDate: Date | null;
};

const db = vi.hoisted(() => ({ receivables: [] as Row[], payables: [] as Row[] }));

type Where = { status?: { notIn?: string[]; not?: string }; dueDate?: { lt?: Date } };

/** Applies the where shapes the dashboard services use. */
function applyWhere(rows: Row[], where: Where | undefined): Row[] {
  return rows.filter((row) => {
    if (where?.status?.notIn && where.status.notIn.includes(row.status)) return false;
    if (where?.status?.not && row.status === where.status.not) return false;
    if (where?.dueDate?.lt && !(row.dueDate !== null && row.dueDate < where.dueDate.lt)) return false;
    return true;
  });
}

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    receivable: { findMany: async ({ where }: { where?: Where } = {}) => applyWhere(db.receivables, where) },
    payable: { findMany: async ({ where }: { where?: Where } = {}) => applyWhere(db.payables, where) },
    salesOrder: { findMany: async () => [], count: async () => 0 },
    batch: { findMany: async () => [] },
  },
}));

import { getAttentionItems } from "@/lib/services/dashboard/get-attention-items";
import { getCommandCenterKpis } from "@/lib/services/dashboard/get-command-center-kpis";
import { openOutstanding, overdueOutstanding } from "@/lib/services/finance/outstanding";

const NOW = new Date("2026-09-28T12:00:00.000Z");
const PAST = new Date("2026-09-20T00:00:00.000Z");
const FUTURE = new Date("2026-10-20T00:00:00.000Z");
const d = (value: string) => new Prisma.Decimal(value);

function row(status: string, amount: string, paid: string, dueDate: Date | null = null, currency = "UAH"): Row {
  return { amount: d(amount), paidAmount: d(paid), status, currency, dueDate };
}

beforeEach(() => {
  db.receivables = [];
  db.payables = [];
});

describe("openOutstanding / overdueOutstanding", () => {
  it("1. OPEN 1000/0 → 1000", () => {
    expect(openOutstanding(row("OPEN", "1000", "0"))?.toString()).toBe("1000");
  });

  it("2. PARTIALLY_PAID 1000/400 → 600", () => {
    expect(openOutstanding(row("PARTIALLY_PAID", "1000", "400"))?.toString()).toBe("600");
  });

  it("3 + 4. PAID and CANCELLED → none", () => {
    expect(openOutstanding(row("PAID", "1000", "1000"))).toBeNull();
    expect(openOutstanding(row("CANCELLED", "1000", "0"))).toBeNull();
  });

  it("5. outstanding <= 0 → none", () => {
    expect(openOutstanding(row("OPEN", "1000", "1000"))).toBeNull();
    expect(openOutstanding(row("OPEN", "1000", "1200"))).toBeNull();
  });

  it("a stored OVERDUE status is just open", () => {
    expect(openOutstanding(row("OVERDUE", "500", "100"))?.toString()).toBe("400");
  });

  it("6. OPEN, due in the past → overdue", () => {
    expect(overdueOutstanding(row("OPEN", "1000", "0", PAST), NOW)?.toString()).toBe("1000");
  });

  it("7. PARTIALLY_PAID, due in the past → only the remainder", () => {
    expect(overdueOutstanding(row("PARTIALLY_PAID", "1000", "400", PAST), NOW)?.toString()).toBe("600");
  });

  it("8. due in the future → not overdue", () => {
    expect(overdueOutstanding(row("OPEN", "1000", "0", FUTURE), NOW)).toBeNull();
  });

  it("9. due exactly now → not overdue (strictly <)", () => {
    expect(overdueOutstanding(row("OPEN", "1000", "0", new Date(NOW)), NOW)).toBeNull();
  });

  it("10. dueDate null → not overdue", () => {
    expect(overdueOutstanding(row("OPEN", "1000", "0", null), NOW)).toBeNull();
  });

  it("11. PAID / CANCELLED past due → not overdue", () => {
    expect(overdueOutstanding(row("PAID", "1000", "1000", PAST), NOW)).toBeNull();
    expect(overdueOutstanding(row("CANCELLED", "1000", "0", PAST), NOW)).toBeNull();
  });
});

describe("getCommandCenterKpis", () => {
  it("receivables / overdue use open balances only", async () => {
    db.receivables = [
      row("OPEN", "1000", "0", PAST),
      row("PARTIALLY_PAID", "1000", "400", PAST),
      row("OPEN", "2000", "0", FUTURE),
      row("OPEN", "300", "0", null),
      row("PAID", "1000", "1000", PAST),
      row("CANCELLED", "5000", "0", PAST),
    ];
    const kpis = await getCommandCenterKpis(NOW);
    // 1000 + 600 + 2000 + 300
    expect(kpis.receivables.outstanding).toEqual([{ currency: "UAH", amount: "3900" }]);
    // 1000 + 600 (future, null, PAID, CANCELLED excluded)
    expect(kpis.receivables.overdueOutstanding).toEqual([{ currency: "UAH", amount: "1600" }]);
  });

  it("12 + 13. payables: open/partially paid remainder only; PAID and CANCELLED excluded", async () => {
    db.payables = [
      row("OPEN", "800", "0"),
      row("PARTIALLY_PAID", "1000", "250"),
      row("PAID", "700", "700"),
      row("CANCELLED", "900", "0"),
    ];
    expect((await getCommandCenterKpis(NOW)).payables.outstanding).toEqual([{ currency: "UAH", amount: "1550" }]);
  });
});

describe("getAttentionItems — overdue customer payments", () => {
  const overdueItems = async () =>
    (await getAttentionItems(NOW)).filter((item) => item.kind === "overdueCustomerPayments");

  it("14. overdue OPEN / PARTIALLY_PAID receivables create an item without any OVERDUE status", async () => {
    db.receivables = [row("OPEN", "1000", "0", PAST), row("PARTIALLY_PAID", "1000", "400", PAST)];
    expect(await overdueItems()).toEqual([{ kind: "overdueCustomerPayments", money: { amount: "1600", currency: "UAH" } }]);
  });

  it("15. future-due, PAID and CANCELLED receivables create no item", async () => {
    db.receivables = [
      row("OPEN", "1000", "0", FUTURE),
      row("OPEN", "1000", "0", null),
      row("PAID", "1000", "1000", PAST),
      row("CANCELLED", "1000", "0", PAST),
    ];
    expect(await overdueItems()).toEqual([]);
  });

  it("uses each record's currency; currencies are never added together", async () => {
    db.receivables = [row("OPEN", "500", "0", PAST, "EUR"), row("OPEN", "1000", "0", PAST, "UAH")];
    expect(await overdueItems()).toEqual([
      { kind: "overdueCustomerPayments", money: { amount: "500", currency: "EUR" } },
      { kind: "overdueCustomerPayments", money: { amount: "1000", currency: "UAH" } },
    ]);
  });
});
