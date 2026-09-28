import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/dashboard/get-command-center-kpis", () => ({
  getCommandCenterKpis: async () => ({
    cashBanks: { value: "0" },
    salesTurnover: { value: "0", currency: "UAH" },
    receivables: { outstanding: [{ currency: "UAH", amount: "176000" }], overdueOutstanding: [] },
    payables: { outstanding: [{ currency: "UAH", amount: "52000" }] },
    inventoryValue: { value: "1250000" },
    grossMargin: { value: "0", percent: "0" },
  }),
}));

import { DashboardKpis } from "@/components/dashboard/dashboard-kpis";
import { kpiData } from "@/components/dashboard/kpi-data";
import { formatKg, formatMoney } from "@/components/sales/format";
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
    for (const id of ["cashBanks", "receivables", "overdueAr", "payables", "inventoryValue", "grossMargin"] as const) {
      expect(html).toContain(escapeHtml(t[id]));
    }
    expect(html).toContain(formatMoney("176000", "UAH", "en"));
    expect(html).toContain(formatMoney("52000", "UAH", "en"));
    expect(html).toContain(formatKg("1250000", "en")); // no currency: Batch.unitCost has none
    expect(html).toContain("0%");
  });
});
