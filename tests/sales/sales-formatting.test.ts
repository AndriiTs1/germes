import { describe, expect, it } from "vitest";

import { formatShortDate } from "@/components/sales/format";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { pluralize } from "@/lib/i18n/pluralize";

/**
 * formatShortDate pins the business timezone (Europe/Kyiv) itself, so
 * these results are the same whatever TZ the machine running Vitest has.
 */
describe("formatShortDate — business timezone", () => {
  it("a late-evening UTC timestamp shows the next Kyiv calendar day", () => {
    // 21:30 UTC on Sep 27 = 00:30 on Sep 28 in Kyiv (UTC+3 in summer).
    expect(formatShortDate("2026-09-27T21:30:00.000Z", "en")).toBe("Sep 28");
    // Same day as Kyiv noon on Sep 28, in the other locales too.
    for (const locale of ["uk", "ru"] as const) {
      expect(formatShortDate("2026-09-27T21:30:00.000Z", locale)).toBe(
        formatShortDate("2026-09-28T09:00:00.000Z", locale),
      );
      expect(formatShortDate("2026-09-27T21:30:00.000Z", locale)).toMatch(/^28\s/);
    }
  });

  it("a mid-day timestamp keeps its date", () => {
    expect(formatShortDate("2026-09-28T12:00:00.000Z", "en")).toBe("Sep 28");
  });

  it("a date-only value stored as UTC midnight does not shift", () => {
    expect(formatShortDate("2026-09-28T00:00:00.000Z", "en")).toBe("Sep 28");
    // Winter (Kyiv UTC+2) too.
    expect(formatShortDate("2026-01-15T00:00:00.000Z", "en")).toBe("Jan 15");
  });
});

describe("overdue receivables KPI — currencies unit", () => {
  const unit = (locale: "ru" | "uk" | "en", count: number) =>
    pluralize(locale, count, getDictionary(locale).sales.workspace.kpi.currenciesUnit);

  it("RU: 1 валюта / 2 валюты / 5 валют", () => {
    expect([1, 2, 5].map((count) => unit("ru", count))).toEqual(["валюта", "валюты", "валют"]);
  });

  it("UK: 1 валюта / 2 валюти / 5 валют", () => {
    expect([1, 2, 5].map((count) => unit("uk", count))).toEqual(["валюта", "валюти", "валют"]);
  });

  it("EN: 1 currency / 2 currencies", () => {
    expect([1, 2].map((count) => unit("en", count))).toEqual(["currency", "currencies"]);
  });
});
