import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/dashboard/get-command-center-kpis", () => ({
  getCommandCenterKpis: async () => ({
    revenue12m: [
      { currency: "EUR", amount: "140250.5" },
      { currency: "UAH", amount: "100123456.78" },
    ],
    receivables: { outstanding: [{ currency: "UAH", amount: "176000" }], overdueOutstanding: [] },
    payables: { outstanding: [{ currency: "UAH", amount: "52000" }] },
    activeOrders: {
      count: 1234,
      byStatus: [
        { status: "CONFIRMED", count: 1000 },
        { status: "PROCESSING", count: 0 },
        { status: "READY", count: 234 },
      ],
    },
  }),
}));

import { DashboardKpis } from "@/components/dashboard/dashboard-kpis";
import { kpiData } from "@/components/dashboard/kpi-data";
import { formatMoney } from "@/components/sales/format";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const FAKE_TRENDS = ["+12%", "+18%", "+24%", "-8%", "+6%", "+2.6 pp"];
const KPI_IDS = ["revenue12m", "receivables", "overdueAr", "payables", "activeOrders"] as const;

/** Labels with "&" would be HTML-escaped in rendered markup. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;");
}

async function renderKpis(locale: "ru" | "uk" | "en") {
  const dictionary = getDictionary(locale);
  const element = await DashboardKpis({ locale, dictionary });
  return { html: renderToStaticMarkup(element), dictionary };
}

describe("Owner Dashboard KPIs — no fake trends", () => {
  it("1. kpiData carries no trend fields or hardcoded trend values", () => {
    for (const kpi of kpiData) {
      expect(Object.keys(kpi).sort()).toEqual(["accent", "icon", "id"]);
    }
    const serialized = JSON.stringify(kpiData.map(({ id, accent }) => ({ id, accent })));
    for (const fake of FAKE_TRENDS) expect(serialized).not.toContain(fake);
  });

  it.each(["ru", "uk", "en"] as const)(
    "2. %s: no comparison label and no hardcoded trend is rendered",
    async (locale) => {
      const { html, dictionary } = await renderKpis(locale);
      expect(html).not.toContain(escapeHtml(dictionary.commandCenter.kpi.comparisonLabel));
      for (const fake of FAKE_TRENDS) expect(html).not.toContain(fake);
    },
  );

  it("3. the KPI values and labels are still rendered unchanged", async () => {
    const { html, dictionary } = await renderKpis("en");
    const t = dictionary.commandCenter.kpi;
    for (const id of KPI_IDS) {
      expect(html).toContain(escapeHtml(t[id]));
    }
    expect(html).toContain(formatMoney("176000", "UAH", "en"));
    expect(html).toContain(formatMoney("52000", "UAH", "en"));
  });
});

describe("Owner Dashboard KPIs — Inventory Value is not shown", () => {
  const INVENTORY_LABELS = ["Inventory Value", "Стоимость запасов", "Вартість запасів"];

  it.each(["en", "ru", "uk"] as const)("1 + 2. %s: no Inventory Value label; the other five KPIs render", async (locale) => {
    const { html, dictionary } = await renderKpis(locale);
    for (const label of INVENTORY_LABELS) expect(html).not.toContain(label);
    for (const id of KPI_IDS) {
      expect(html).toContain(escapeHtml(dictionary.commandCenter.kpi[id]));
    }
  });

  it("3. exactly five KPI cards (desktop tiles and mobile rows alike)", async () => {
    expect(kpiData.map((kpi) => kpi.id)).toEqual([...KPI_IDS]);
    const { html } = await renderKpis("en");
    // one <li> per KPI in the mobile summary card
    expect(html.match(/<li>/g)).toHaveLength(5);
  });

  it("the dictionaries no longer carry an Inventory Value KPI label", () => {
    for (const locale of ["en", "ru", "uk"] as const) {
      expect(Object.keys(getDictionary(locale).commandCenter.kpi)).not.toContain("inventoryValue");
    }
  });
});

describe("Owner Dashboard KPIs — final five (no placeholders)", () => {
  const CASH_LABELS = ["Cash & Banks", "Денежные средства и банки", "Грошові кошти та банки"];
  const MARGIN_LABELS = ["Gross Margin", "Валовая маржа", "Валова маржа"];
  const REVENUE = { en: "Revenue — last 12 months", ru: "Выручка за 12 месяцев", uk: "Виручка за 12 місяців" };
  const ACTIVE = { en: "Active orders", ru: "Активные заказы", uk: "Активні замовлення" };

  it.each(["en", "ru", "uk"] as const)("1–4. %s: no cash / gross-margin cards; revenue 12m and active orders present", async (locale) => {
    const { html } = await renderKpis(locale);
    for (const label of [...CASH_LABELS, ...MARGIN_LABELS]) expect(html).not.toContain(escapeHtml(label));
    expect(html).not.toContain("0%");
    expect(html).toContain(REVENUE[locale]);
    expect(html).toContain(ACTIVE[locale]);
  });

  it("5. KPI count = 5, in the agreed order", async () => {
    expect(kpiData.map((kpi) => kpi.id)).toEqual(["revenue12m", "receivables", "overdueAr", "payables", "activeOrders"]);
    const { html } = await renderKpis("en");
    expect(html.match(/<li>/g)).toHaveLength(5);
  });

  it("revenue shows one formatted line per currency (never summed); active orders is a formatted count", async () => {
    const { html } = await renderKpis("uk");
    expect(html).toContain(formatMoney("140250.5", "EUR", "uk"));
    expect(html).toContain(formatMoney("100123456.78", "UAH", "uk"));
    expect(html).not.toContain("100123456.78");
    expect(html).toContain(new Intl.NumberFormat("uk-UA").format(1234));
  });

  it.each(["ru", "uk", "en"] as const)(
    "%s: active orders show their status breakdown (real status labels, formatted counts, zero kept)",
    async (locale) => {
      const { html, dictionary } = await renderKpis(locale);
      const fmt = new Intl.NumberFormat(locale === "en" ? "en-US" : locale === "uk" ? "uk-UA" : "ru-RU");
      expect(html).toContain(`aria-label="${dictionary.commandCenter.kpi.activeOrdersByStatus}"`);
      for (const [status, value] of [
        ["CONFIRMED", 1000],
        ["PROCESSING", 0],
        ["READY", 234],
      ] as const) {
        expect(html).toContain(
          `<span class="text-slate-500">${dictionary.status.order[status]}</span><span class="font-semibold tabular-nums text-slate-900">${fmt.format(value)}</span>`,
        );
      }
      // Desktop tile + mobile row: one breakdown list each, and only on the active-orders KPI.
      expect(html.match(/aria-label="[^"]*"/g)).toHaveLength(2);
    },
  );

  it("dictionaries no longer carry cashBanks / grossMargin KPI labels", () => {
    for (const locale of ["en", "ru", "uk"] as const) {
      const keys = Object.keys(getDictionary(locale).commandCenter.kpi);
      expect(keys).not.toContain("cashBanks");
      expect(keys).not.toContain("grossMargin");
    }
  });
});
