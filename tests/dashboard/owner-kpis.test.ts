import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/dashboard/get-command-center-kpis", () => ({
  getCommandCenterKpis: async () => ({
    cashBanks: { value: "0" },
    salesTurnover: { value: "0", currency: "UAH" },
    receivables: { outstanding: [{ currency: "UAH", amount: "176000" }], overdueOutstanding: [] },
    payables: { outstanding: [{ currency: "UAH", amount: "52000" }] },
    grossMargin: { value: "0", percent: "0" },
  }),
}));

import { DashboardKpis } from "@/components/dashboard/dashboard-kpis";
import { kpiData } from "@/components/dashboard/kpi-data";
import { formatMoney } from "@/components/sales/format";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const FAKE_TRENDS = ["+12%", "+18%", "+24%", "-8%", "+6%", "+2.6 pp"];

/** Labels like "Cash & Banks" are HTML-escaped in rendered markup. */
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
    for (const id of ["cashBanks", "receivables", "overdueAr", "payables", "grossMargin"] as const) {
      expect(html).toContain(escapeHtml(t[id]));
    }
    expect(html).toContain(formatMoney("176000", "UAH", "en"));
    expect(html).toContain(formatMoney("52000", "UAH", "en"));
    expect(html).toContain("0%");
  });
});

describe("Owner Dashboard KPIs — Inventory Value is not shown", () => {
  const INVENTORY_LABELS = ["Inventory Value", "Стоимость запасов", "Вартість запасів"];

  it.each(["en", "ru", "uk"] as const)("1 + 2. %s: no Inventory Value label; the other five KPIs render", async (locale) => {
    const { html, dictionary } = await renderKpis(locale);
    for (const label of INVENTORY_LABELS) expect(html).not.toContain(label);
    for (const id of ["cashBanks", "receivables", "overdueAr", "payables", "grossMargin"] as const) {
      expect(html).toContain(escapeHtml(dictionary.commandCenter.kpi[id]));
    }
  });

  it("3. exactly five KPI cards (desktop tiles and mobile rows alike)", async () => {
    expect(kpiData.map((kpi) => kpi.id)).toEqual(["cashBanks", "receivables", "overdueAr", "payables", "grossMargin"]);
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
