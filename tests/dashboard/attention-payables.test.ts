import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/lib/generated/prisma/client";

type Row = {
  amount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  status: string;
  currency: string;
  dueDate: Date | null;
};

type Where = { status?: { notIn?: string[]; not?: string }; dueDate?: { lt?: Date } };

const db = vi.hoisted(() => ({ receivables: [] as Row[], payables: [] as Row[] }));

/** Applies the where shapes get-attention-items uses, so its status filter is under test too. */
function applyWhere(rows: Row[], where: Where | undefined): Row[] {
  return rows.filter((row) => {
    if (where?.status?.notIn?.includes(row.status)) return false;
    if (where?.status?.not && row.status === where.status.not) return false;
    if (where?.dueDate?.lt && !(row.dueDate !== null && row.dueDate < where.dueDate.lt)) return false;
    return true;
  });
}

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    receivable: { findMany: async ({ where }: { where?: Where } = {}) => applyWhere(db.receivables, where) },
    payable: { findMany: async ({ where }: { where?: Where } = {}) => applyWhere(db.payables, where) },
    salesOrder: { count: async () => 0 },
  },
}));

import { NeedsAttention } from "@/components/dashboard/operations/needs-attention";
import { formatMoney } from "@/components/sales/format";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getAttentionItems } from "@/lib/services/dashboard/get-attention-items";

const NOW = new Date("2026-09-28T12:00:00.000Z");
const PAST = new Date("2026-09-20T00:00:00.000Z");
const d = (value: string) => new Prisma.Decimal(value);

function payable(status: string, amount: string, paid: string, currency = "UAH"): Row {
  return { amount: d(amount), paidAmount: d(paid), status, currency, dueDate: null };
}

const payableItems = async () =>
  (await getAttentionItems(NOW)).filter((item) => item.kind === "openSupplierPayables");

beforeEach(() => {
  db.receivables = [];
  db.payables = [];
});

describe("getAttentionItems — open supplier payables", () => {
  it("1. OPEN 1000 UAH → 1000 UAH", async () => {
    db.payables = [payable("OPEN", "1000", "0")];
    expect(await payableItems()).toEqual([{ kind: "openSupplierPayables", money: { amount: "1000", currency: "UAH" } }]);
  });

  it("2. PARTIALLY_PAID 1000/400 → only the 600 UAH remainder", async () => {
    db.payables = [payable("PARTIALLY_PAID", "1000", "400")];
    expect(await payableItems()).toEqual([{ kind: "openSupplierPayables", money: { amount: "600", currency: "UAH" } }]);
  });

  it("3. PAID is not counted", async () => {
    db.payables = [payable("PAID", "1000", "1000"), payable("OPEN", "100", "0")];
    expect(await payableItems()).toEqual([{ kind: "openSupplierPayables", money: { amount: "100", currency: "UAH" } }]);
  });

  it("4. CANCELLED is not counted", async () => {
    db.payables = [payable("CANCELLED", "5000", "0")];
    expect(await payableItems()).toEqual([]);
  });

  it("5. outstanding <= 0 is not counted (and never reduces another balance)", async () => {
    db.payables = [payable("OPEN", "1000", "1000"), payable("PARTIALLY_PAID", "1000", "1300"), payable("OPEN", "200", "0")];
    expect(await payableItems()).toEqual([{ kind: "openSupplierPayables", money: { amount: "200", currency: "UAH" } }]);
  });

  it("a stored OVERDUE status with a balance counts as open", async () => {
    db.payables = [payable("OVERDUE", "300", "100")];
    expect(await payableItems()).toEqual([{ kind: "openSupplierPayables", money: { amount: "200", currency: "UAH" } }]);
  });

  it("6. 1000 UAH + 100 EUR → two items, never 1100 UAH", async () => {
    db.payables = [payable("OPEN", "1000", "0", "UAH"), payable("OPEN", "100", "0", "EUR")];
    const items = await payableItems();
    expect(items).toHaveLength(2);
    expect(items.map((item) => `${item.money?.amount} ${item.money?.currency}`)).not.toContain("1100 UAH");
  });

  it("7. currency order is deterministic (by code), whatever the row order", async () => {
    db.payables = [payable("OPEN", "1", "0", "USD"), payable("OPEN", "2", "0", "UAH"), payable("OPEN", "3", "0", "EUR")];
    const first = (await payableItems()).map((item) => `${item.money?.amount} ${item.money?.currency}`);
    db.payables = [...db.payables].reverse();
    const second = (await payableItems()).map((item) => `${item.money?.amount} ${item.money?.currency}`);
    expect(first).toEqual(["3 EUR", "2 UAH", "1 USD"]);
    expect(second).toEqual(first);
  });

  it("8. no payables → no payable item", async () => {
    expect(await payableItems()).toEqual([]);
  });

  it("9. EUR-only data gives EUR (no hardcoded UAH)", async () => {
    db.payables = [payable("OPEN", "250", "0", "EUR"), payable("PARTIALLY_PAID", "100", "40", "EUR")];
    expect(await payableItems()).toEqual([{ kind: "openSupplierPayables", money: { amount: "310", currency: "EUR" } }]);
  });

  it("11. overdue receivable items are unchanged next to payable items", async () => {
    db.receivables = [{ ...payable("OPEN", "1000", "0"), dueDate: PAST }];
    db.payables = [payable("OPEN", "50", "0", "EUR")];
    expect(await getAttentionItems(NOW)).toEqual([
      { kind: "overdueCustomerPayments", money: { amount: "1000", currency: "UAH" } },
      { kind: "openSupplierPayables", money: { amount: "50", currency: "EUR" } },
    ]);
  });
});

describe("Needs Attention card — payable label", () => {
  it.each(["en", "uk", "ru"] as const)("10. %s: open-payables label, no approval wording, per-currency values", async (locale) => {
    db.payables = [payable("OPEN", "1000", "0", "UAH"), payable("OPEN", "100", "0", "EUR")];
    const dictionary = getDictionary(locale);
    const html = renderToStaticMarkup(await NeedsAttention({ locale, dictionary }));
    const label = dictionary.commandCenter.needsAttention.openSupplierPayables;
    expect(html.split(label).length - 1).toBe(2);
    expect(html).toContain(formatMoney("1000", "UAH", locale));
    expect(html).toContain(formatMoney("100", "EUR", locale));
    expect(label).not.toMatch(/approv|утвержд|затвердж|согласов|погодж/i);
    expect(html).not.toMatch(/approv|утвержд|затвердж|согласов|погодж/i);
  });
});
