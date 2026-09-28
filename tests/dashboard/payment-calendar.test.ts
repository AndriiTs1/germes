import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/lib/generated/prisma/client";

type Row = {
  id: string;
  amount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  currency: string;
  status: string;
  dueDate: Date | null;
};

type Query = {
  where?: { status?: { notIn?: string[] }; dueDate?: { lt?: Date; gte?: Date } };
  orderBy?: { dueDate?: "asc" | "desc"; id?: "asc" | "desc" }[];
  take?: number;
};

const db = vi.hoisted(() => ({ receivables: [] as Row[], payables: [] as Row[] }));

/** Applies the where/orderBy/take shapes getPaymentCalendar uses (a null dueDate never matches lt/gte, as in SQL). */
function runQuery(rows: Row[], { where, orderBy = [], take }: Query = {}): Row[] {
  const filtered = rows.filter((row) => {
    if (where?.status?.notIn?.includes(row.status)) return false;
    if (where?.dueDate?.lt && !(row.dueDate !== null && row.dueDate < where.dueDate.lt)) return false;
    if (where?.dueDate?.gte && !(row.dueDate !== null && row.dueDate >= where.dueDate.gte)) return false;
    return true;
  });
  filtered.sort((a, b) => {
    for (const order of orderBy) {
      const [key, dir] = Object.entries(order)[0] as ["dueDate" | "id", "asc" | "desc"];
      const av = key === "dueDate" ? a.dueDate!.getTime() : a.id;
      const bv = key === "dueDate" ? b.dueDate!.getTime() : b.id;
      if (av !== bv) return (av < bv ? -1 : 1) * (dir === "asc" ? 1 : -1);
    }
    return 0;
  });
  return take === undefined ? filtered : filtered.slice(0, take);
}

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    receivable: { findMany: async (query: Query) => runQuery(db.receivables, query) },
    payable: { findMany: async (query: Query) => runQuery(db.payables, query) },
  },
}));

import { PaymentCalendar } from "@/components/dashboard/operations/payment-calendar";
import { formatMoney } from "@/components/sales/format";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getPaymentCalendar } from "@/lib/services/dashboard/get-payment-calendar";

const NOW = new Date("2026-09-28T12:00:00.000Z");
const d = (value: string) => new Prisma.Decimal(value);
let seq = 0;

function row(status: string, amount: string, paid: string, dueDate: string | null, currency = "UAH"): Row {
  seq += 1;
  return {
    id: `id-${String(seq).padStart(3, "0")}`,
    amount: d(amount),
    paidAmount: d(paid),
    currency,
    status,
    dueDate: dueDate === null ? null : new Date(dueDate),
  };
}

const PAST = "2026-09-20T12:00:00.000Z";
const FUTURE = "2026-10-05T12:00:00.000Z";
const calendar = () => getPaymentCalendar(NOW);

beforeEach(() => {
  db.receivables = [];
  db.payables = [];
  seq = 0;
});

describe.each([
  ["receivables", "customerReceipt"],
  ["payables", "supplierPayment"],
] as const)("getPaymentCalendar — which %s appear (open balance only)", (table, eventType) => {
  it("1 + 2. CANCELLED and PAID are excluded", async () => {
    db[table] = [row("CANCELLED", "1000", "0", FUTURE), row("PAID", "1000", "1000", FUTURE)];
    expect(await calendar()).toEqual([]);
  });

  it("3. PARTIALLY_PAID 1000/400 shows 600", async () => {
    db[table] = [row("PARTIALLY_PAID", "1000", "400", FUTURE)];
    expect(await calendar()).toMatchObject([{ eventType, amount: "600", currency: "UAH" }]);
  });

  it("4. OPEN 1000/0 shows 1000", async () => {
    db[table] = [row("OPEN", "1000", "0", FUTURE)];
    expect(await calendar()).toMatchObject([{ eventType, amount: "1000" }]);
  });

  it("5. outstanding <= 0 is excluded", async () => {
    db[table] = [row("OPEN", "1000", "1000", FUTURE), row("PARTIALLY_PAID", "1000", "1200", FUTURE)];
    expect(await calendar()).toEqual([]);
  });

  it("7. dueDate = null is excluded", async () => {
    db[table] = [row("OPEN", "1000", "0", null)];
    expect(await calendar()).toEqual([]);
  });

  it("13. CANCELLED with a past dueDate is excluded", async () => {
    db[table] = [row("CANCELLED", "1000", "0", PAST)];
    expect(await calendar()).toEqual([]);
  });
});

describe("getPaymentCalendar — overdue is dueDate < now", () => {
  it("8. dueDate < now → overdue", async () => {
    db.receivables = [row("OPEN", "1000", "0", PAST)];
    expect((await calendar())[0].status).toBe("overdue");
  });

  it("9. dueDate == now → not overdue", async () => {
    db.receivables = [row("OPEN", "1000", "0", NOW.toISOString())];
    expect((await calendar())[0].status).toBe("positive");
  });

  it("10. dueDate > now → not overdue (receivable incoming, payable upcoming)", async () => {
    db.receivables = [row("OPEN", "1000", "0", FUTURE)];
    db.payables = [row("OPEN", "500", "0", FUTURE)];
    expect((await calendar()).map((event) => event.status).sort()).toEqual(["positive", "upcoming"]);
  });

  it("11 + 12. OPEN / PARTIALLY_PAID past due are overdue without any OVERDUE status; a stored OVERDUE in the future is not", async () => {
    db.receivables = [row("OPEN", "1000", "0", PAST), row("OVERDUE", "300", "0", FUTURE)];
    db.payables = [row("PARTIALLY_PAID", "900", "100", PAST)];
    const events = await calendar();
    expect(events.filter((event) => event.status === "overdue").map((event) => event.amount).sort()).toEqual([
      "1000",
      "800",
    ]);
    expect(events.find((event) => event.amount === "300")?.status).toBe("positive");
  });
});

describe("getPaymentCalendar — order, selection, currency", () => {
  it("14. sorted by the full dueDate: Dec 2026 before Jan 2027 (and Jan 2027 before Feb 2027)", async () => {
    db.receivables = [
      row("OPEN", "3", "0", "2027-02-10T12:00:00.000Z"),
      row("OPEN", "1", "0", "2026-12-20T12:00:00.000Z"),
      row("OPEN", "2", "0", "2027-01-05T12:00:00.000Z"),
    ];
    expect((await calendar()).map((event) => event.amount)).toEqual(["1", "2", "3"]);
  });

  it("equal dueDate → stable id tie-breaker", async () => {
    db.receivables = [row("OPEN", "1", "0", FUTURE), row("OPEN", "2", "0", FUTURE)];
    db.payables = [row("OPEN", "3", "0", FUTURE)];
    expect((await calendar()).map((event) => event.id)).toEqual(["id-001", "id-002", "id-003"]);
  });

  it("16. each event keeps its own currency (no mixing, no hardcoded UAH)", async () => {
    db.receivables = [row("OPEN", "600", "0", FUTURE, "UAH"), row("OPEN", "100", "0", PAST, "EUR")];
    db.payables = [row("OPEN", "50", "0", FUTURE, "EUR")];
    expect(
      (await calendar()).map(({ amount, currency, eventType }) => `${eventType} ${amount} ${currency}`).sort(),
    ).toEqual(["customerReceipt 100 EUR", "customerReceipt 600 UAH", "supplierPayment 50 EUR"]);
  });

  it("17. relevant overdue + nearest upcoming, not the 5 oldest rows", async () => {
    db.receivables = [
      // six old overdue rows — the old implementation showed the oldest five
      row("OPEN", "11", "0", "2025-01-10T12:00:00.000Z"),
      row("OPEN", "12", "0", "2025-02-10T12:00:00.000Z"),
      row("OPEN", "13", "0", "2025-03-10T12:00:00.000Z"),
      row("OPEN", "14", "0", "2026-08-10T12:00:00.000Z"),
      row("OPEN", "15", "0", "2026-09-25T12:00:00.000Z"),
      // upcoming, nearest first after sorting
      row("OPEN", "23", "0", "2026-12-01T12:00:00.000Z"),
      row("OPEN", "21", "0", "2026-10-01T12:00:00.000Z"),
    ];
    db.payables = [row("OPEN", "22", "0", "2026-10-15T12:00:00.000Z"), row("OPEN", "24", "0", "2027-03-01T12:00:00.000Z")];
    const events = await calendar();
    expect(events).toHaveLength(5);
    // 2 most recent overdue + 3 nearest upcoming, chronological
    expect(events.map((event) => event.amount)).toEqual(["14", "15", "21", "22", "23"]);
  });

  it("few upcoming → free slots go to more overdue (most recent first)", async () => {
    db.receivables = [
      row("OPEN", "1", "0", "2026-06-01T12:00:00.000Z"),
      row("OPEN", "2", "0", "2026-07-01T12:00:00.000Z"),
      row("OPEN", "3", "0", "2026-08-01T12:00:00.000Z"),
      row("OPEN", "4", "0", "2026-09-01T12:00:00.000Z"),
      row("OPEN", "5", "0", "2026-09-10T12:00:00.000Z"),
      row("OPEN", "9", "0", FUTURE),
    ];
    expect((await calendar()).map((event) => event.amount)).toEqual(["2", "3", "4", "5", "9"]);
  });
});

describe("Payment Calendar card", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function render(locale: "en" | "uk" | "ru" = "en") {
    const element = await PaymentCalendar({ locale, dictionary: getDictionary(locale) });
    return renderToStaticMarkup(element);
  }

  it("15. shows the Europe/Kyiv day around the UTC day boundary", async () => {
    // 31 Dec 2026 22:30 UTC = 1 Jan 2027 00:30 in Kyiv (UTC+2).
    db.receivables = [row("OPEN", "1000", "0", "2026-12-31T22:30:00.000Z")];
    const html = await render("en");
    expect(html).toContain(">Jan</span>");
    expect(html).toContain(">1</span>");
    expect(html).not.toContain(">Dec</span>");
    expect(html).not.toContain(">31</span>");
  });

  it("overdue is red, amounts are the formatted open balance in their own currency", async () => {
    db.receivables = [row("PARTIALLY_PAID", "1000", "400", PAST, "UAH")];
    db.payables = [row("OPEN", "1234.5", "0", FUTURE, "EUR")];
    const html = await render("en");
    const t = getDictionary("en").commandCenter.paymentCalendar;
    expect(html).toContain(formatMoney("600", "UAH", "en"));
    expect(html).toContain(formatMoney("1234.5", "EUR", "en"));
    expect(html).not.toContain(formatMoney("1000", "UAH", "en"));
    expect(html).toContain(t.status.overdue);
    expect(html).toContain("text-rose-600");
    expect(html).toContain(t.events.customerReceipt);
    expect(html).toContain(t.events.supplierPayment);
  });

  it.each(["en", "uk", "ru"] as const)("18. %s: empty data → empty-state message, no rows", async (locale) => {
    const html = await render(locale);
    expect(html).toContain(getDictionary(locale).commandCenter.paymentCalendar.empty);
    expect(html).not.toContain("<li");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("NaN");
  });
});
