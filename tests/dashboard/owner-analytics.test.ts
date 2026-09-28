import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ getCashFlow: vi.fn() }));

vi.mock("@/lib/services/dashboard/get-cash-flow", () => ({ getCashFlow: m.getCashFlow }));
vi.mock("@/lib/services/dashboard/get-sales-performance", () => ({
  getSalesPerformance: async () => ({
    months: [
      { year: 2026, month: 8 },
      { year: 2026, month: 9 },
    ],
    series: [{ currency: "UAH", total: "150", monthly: ["50", "100"], orderCount: 2 }],
    trend: { currency: "UAH", direction: "up", percent: "100" },
  }),
}));
vi.mock("@/lib/services/dashboard/get-inventory-status", () => ({
  getInventoryStatus: async () => ({ value: "0", segments: [] }),
}));
vi.mock("@/lib/services/dashboard/get-procurement-needs", () => ({
  getProcurementNeeds: async () => ({ value: "0", items: [] }),
}));

import { DashboardAnalytics } from "@/components/dashboard/analytics/dashboard-analytics";
import { getDictionary } from "@/lib/i18n/get-dictionary";

type AsyncCard = ReactElement<Record<string, unknown>, (props: Record<string, unknown>) => Promise<ReactElement>>;

/** Renders DashboardAnalytics with its async server-component cards resolved (renderToStaticMarkup can't await them). */
async function renderAnalytics(locale: "ru" | "uk" | "en") {
  const dictionary = getDictionary(locale);
  const grid = DashboardAnalytics({ locale, dictionary }) as ReactElement<{ children: AsyncCard[] }>;
  const cards = await Promise.all(grid.props.children.map((card) => card.type(card.props)));
  return { html: cards.map((card) => renderToStaticMarkup(card)).join(""), cardCount: cards.length, dictionary };
}

beforeEach(() => {
  m.getCashFlow.mockReset();
});

describe("Owner Dashboard analytics — no synthetic cash flow", () => {
  it.each(["ru", "uk", "en"] as const)("1. %s: the Cash Flow card is not rendered", async (locale) => {
    const { html, dictionary } = await renderAnalytics(locale);
    expect(html).not.toContain(dictionary.commandCenter.cashFlow.title);
    expect(html).not.toContain(dictionary.commandCenter.cashFlow.netForLabel);
  });

  it("2. getCashFlow is not called", async () => {
    await renderAnalytics("en");
    expect(m.getCashFlow).not.toHaveBeenCalled();
  });

  it("3. the other analytics cards are still rendered", async () => {
    const { html, cardCount, dictionary } = await renderAnalytics("en");
    const t = dictionary.commandCenter;
    expect(cardCount).toBe(3);
    expect(html).toContain(t.salesPerformance.title);
    expect(html).toContain(t.inventoryStatus.title);
    expect(html).toContain(t.procurementNeeds.title);
  });
});
