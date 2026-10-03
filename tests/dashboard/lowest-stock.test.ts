import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/lib/generated/prisma/client";

type Movement = { type: string; fromWarehouseId: string | null; toWarehouseId: string | null; quantityKg: Prisma.Decimal };
type ProductRow = {
  id: string;
  sku: string;
  name: string;
  isActive: boolean;
  batches: { id: string; stockMovements: Movement[] }[];
};

const db = vi.hoisted(() => ({ products: [] as ProductRow[] }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    product: {
      findMany: async ({ where }: { where?: { isActive?: boolean } } = {}) =>
        db.products.filter((p) => where?.isActive === undefined || p.isActive === where.isActive),
    },
  },
}));

import { ProcurementNeeds } from "@/components/dashboard/analytics/procurement-needs";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getProcurementNeeds } from "@/lib/services/dashboard/get-procurement-needs";

const d = (value: string) => new Prisma.Decimal(value);
/**
 * A movement shaped like real data: RECEIPT/ADJUSTMENT-in arrive at w1,
 * SHIPMENT/WRITE_OFF leave w1, TRANSFER moves w1 → w2. Override from/to
 * for anything else (e.g. an ADJUSTMENT that removes stock).
 */
const mv = (type: string, kg: string, warehouses?: { from?: string | null; to?: string | null }): Movement => {
  const defaults: Record<string, { from: string | null; to: string | null }> = {
    RECEIPT: { from: null, to: "w1" },
    SHIPMENT: { from: "w1", to: null },
    WRITE_OFF: { from: "w1", to: null },
    TRANSFER: { from: "w1", to: "w2" },
    ADJUSTMENT: { from: null, to: "w1" },
  };
  const { from, to } = { ...defaults[type], ...warehouses };
  return { type, fromWarehouseId: from ?? null, toWarehouseId: to ?? null, quantityKg: d(kg) };
};

/** A product whose single batch has the given movements. */
function product(sku: string, movements: Movement[], opts: { id?: string; isActive?: boolean } = {}): ProductRow {
  return {
    id: opts.id ?? `id-${sku}`,
    sku,
    name: `Product ${sku}`,
    isActive: opts.isActive ?? true,
    batches: [{ id: `b-${sku}`, stockMovements: movements }],
  };
}

/** A product with exactly `kg` in stock (one receipt, or nothing for zero). */
const stocked = (sku: string, kg: string, opts?: { id?: string; isActive?: boolean }) =>
  product(sku, kg === "0" ? [] : [mv("RECEIPT", kg)], opts);

async function render(locale: "en" | "ru" | "uk") {
  const dictionary = getDictionary(locale);
  const html = renderToStaticMarkup(await ProcurementNeeds({ dictionary }));
  return { html, t: dictionary.commandCenter.procurementNeeds };
}

beforeEach(() => {
  db.products = [];
});

describe("Lowest stock card — honest wording", () => {
  it.each([
    ["ru", "Минимальные остатки", "Товары с наименьшим остатком"],
    ["uk", "Найнижчі залишки", "Товари з найменшим залишком"],
    ["en", "Lowest stock", "Products with the lowest stock"],
  ] as const)("1–3. %s: title and caption", async (locale, title, caption) => {
    db.products = [stocked("A", "10")];
    const { html } = await render(locale);
    expect(html).toContain(title);
    expect(html).toContain(caption);
  });

  it.each(["ru", "uk", "en"] as const)("4. %s: no procurement-need wording is rendered", async (locale) => {
    db.products = [stocked("A", "0"), stocked("B", "5"), stocked("C", "9")];
    const { html } = await render(locale);
    for (const old of [
      "Потребности в закупках", "Позиций к заказу", "Критично", "Внимание",
      "Потреби в закупівлях", "Позицій до замовлення", "Увага",
      "Procurement Needs", "Items to reorder", "Critical", "Warning",
    ]) {
      expect(html).not.toContain(old);
    }
  });
});

describe("getProcurementNeeds — the three lowest-stock active products", () => {
  it("5. exactly the 3 lowest, ascending", async () => {
    db.products = [stocked("A", "500"), stocked("B", "20"), stocked("C", "0"), stocked("D", "75"), stocked("E", "3000")];
    const { value, items } = await getProcurementNeeds();
    expect(value).toBe("3");
    expect(items.map((item) => [item.sku, item.stockKg])).toEqual([
      ["C", 0],
      ["B", 20],
      ["D", 75],
    ]);
  });

  it("inactive products are ignored", async () => {
    db.products = [stocked("A", "0", { isActive: false }), stocked("B", "5"), stocked("C", "6"), stocked("D", "7")];
    expect((await getProcurementNeeds()).items.map((item) => item.sku)).toEqual(["B", "C", "D"]);
  });

  it("6. equal stock is ordered by SKU (then id), never by database order", async () => {
    const all = [stocked("PORK-002", "0"), stocked("BEEF-010", "0"), stocked("POULTRY-001", "0"), stocked("BEEF-002", "0")];
    db.products = all;
    const first = (await getProcurementNeeds()).items.map((item) => item.sku);
    db.products = [...all].reverse();
    const second = (await getProcurementNeeds()).items.map((item) => item.sku);
    expect(first).toEqual(["BEEF-002", "BEEF-010", "PORK-002"]);
    expect(second).toEqual(first);
  });

  it("ties are decided on exact stock, not the rounded display value", async () => {
    // 0.4 and 0.2 both display as 0 kg, but 0.2 is lower.
    db.products = [stocked("A", "0.4"), stocked("B", "0.2"), stocked("C", "1")];
    expect((await getProcurementNeeds()).items.map((item) => item.sku)).toEqual(["B", "A", "C"]);
  });

  it("9. fewer than 3 active products → count equals what is shown; none → 0 and no rows", async () => {
    db.products = [stocked("A", "4"), stocked("B", "0")];
    const two = await getProcurementNeeds();
    expect(two.value).toBe("2");
    expect(two.items).toHaveLength(2);

    db.products = [];
    const none = await getProcurementNeeds();
    expect(none).toEqual({ value: "0", items: [] });
    const { html } = await render("en");
    expect(html).not.toContain("<li");
  });

  it("10. stock follows each movement's from/to (shared rule); all batches summed", async () => {
    db.products = [
      {
        ...product("A", []),
        batches: [
          {
            id: "b1",
            stockMovements: [
              mv("RECEIPT", "100"),
              mv("SHIPMENT", "30"),
              mv("TRANSFER", "5"),
              mv("WRITE_OFF", "10"),
              mv("ADJUSTMENT", "4"),
              mv("ADJUSTMENT", "1", { from: "w1", to: null }),
            ],
          },
          { id: "b2", stockMovements: [mv("RECEIPT", "40.6")] },
        ],
      },
    ];
    // 100 − 30 + 0 (transfer) − 10 + 4 − 1 + 40.6 = 103.6 → displayed rounded
    expect((await getProcurementNeeds()).items[0]).toMatchObject({ sku: "A", stockKg: 104, outOfStock: false });
  });

  it("10a. regression: a TRANSFER between warehouses does not create stock", async () => {
    db.products = [product("A", [mv("RECEIPT", "50"), mv("TRANSFER", "50")]), stocked("B", "60")];
    const { items } = await getProcurementNeeds();
    expect(items.map((item) => [item.sku, item.stockKg])).toEqual([["A", 50], ["B", 60]]);
  });

  it("10b. regression: stock fully moved then shipped from the second warehouse is out of stock", async () => {
    db.products = [product("A", [mv("RECEIPT", "20"), mv("TRANSFER", "20"), mv("SHIPMENT", "20", { from: "w2", to: null })])];
    expect((await getProcurementNeeds()).items[0]).toMatchObject({ sku: "A", stockKg: 0, outOfStock: true });
  });
});

describe("Lowest stock card — badges", () => {
  it.each([
    ["ru", "Нет в наличии"],
    ["uk", "Немає в наявності"],
    ["en", "Out of stock"],
  ] as const)("7. %s: stock = 0 shows the out-of-stock badge", async (locale, badge) => {
    db.products = [stocked("A", "0")];
    const { html } = await render(locale);
    expect(html).toContain(badge);
    expect(html).toContain("bg-rose-50");
  });

  it("8. stock > 0 gets no urgency badge at all (not even for very little stock)", async () => {
    db.products = [stocked("A", "0.2"), stocked("B", "12"), stocked("C", "9000")];
    const { html, t } = await render("en");
    expect(html).not.toContain(t.outOfStock);
    expect(html).not.toContain("rounded-full"); // no badge pill rendered
    expect(html).not.toContain("bg-rose-50");
    expect(html).toContain(`${t.stockLabel} 12`);
  });

  it("only the zero-stock row is badged in a mixed list", async () => {
    db.products = [stocked("A", "0"), stocked("B", "5"), stocked("C", "8")];
    const { html, t } = await render("en");
    expect(html.split(t.outOfStock).length - 1).toBe(1);
  });
});

describe("Lowest stock card — sub-kilogram stock is not shown as 0", () => {
  const CASES = [
    ["ru", "Остаток:", "кг", "Нет в наличии"],
    ["uk", "Залишок:", "кг", "Немає в наявності"],
    ["en", "Stock:", "kg", "Out of stock"],
  ] as const;

  it.each(CASES)("1. %s: exact 0 → \"0\" + out-of-stock badge", async (locale, label, unit, badge) => {
    db.products = [stocked("A", "0")];
    const { html } = await render(locale);
    expect(html).toContain(`${label} 0 ${unit}`);
    expect(html).toContain(badge);
  });

  it.each(CASES)("2. %s: 0.3 → \"<1\", no badge", async (locale, label, unit, badge) => {
    db.products = [stocked("A", "0.3")];
    const { html } = await render(locale);
    expect(html).toContain(`${label} &lt;1 ${unit}`); // "<" is HTML-escaped
    expect(html).not.toContain(`${label} 0 ${unit}`);
    expect(html).not.toContain(badge);
  });

  it.each(CASES)("3. %s: 1.2 → whole kg as before, no badge", async (locale, label, unit, badge) => {
    db.products = [stocked("A", "1.2")];
    const { html } = await render(locale);
    expect(html).toContain(`${label} 1 ${unit}`);
    expect(html).not.toContain("&lt;1");
    expect(html).not.toContain(badge);
  });

  it("decided on the exact Decimal: 0.6 (rounds to 1) still shows <1; exactly 1 shows 1", async () => {
    db.products = [stocked("A", "0.6"), stocked("B", "1")];
    const { items } = await getProcurementNeeds();
    expect(items.map(({ sku, stockKg, belowOneKg, outOfStock }) => ({ sku, stockKg, belowOneKg, outOfStock }))).toEqual([
      { sku: "A", stockKg: 1, belowOneKg: true, outOfStock: false },
      { sku: "B", stockKg: 1, belowOneKg: false, outOfStock: false },
    ]);
    const { html } = await render("en");
    expect(html).toContain("Stock: &lt;1 kg");
    expect(html).toContain("Stock: 1 kg");
  });
});
