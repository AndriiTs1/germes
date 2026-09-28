import { describe, expect, it, vi } from "vitest";

// Only the pure window helper is exercised; no database is involved.
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import {
  getPlannedArrivalWindow,
  PLANNED_ARRIVAL_WINDOW_DAYS,
} from "@/lib/services/procurement/get-procurement-workspace-overview";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Same half-open check the service's where clause uses: gte from, lt to. */
function inWindow(date: Date, window: { from: Date; to: Date }): boolean {
  return date >= window.from && date < window.to;
}

describe("getPlannedArrivalWindow", () => {
  const now = new Date("2026-09-28T14:35:10.123Z");
  const window = getPlannedArrivalWindow(now);

  it("starts at the beginning of the current UTC day", () => {
    expect(window.from.toISOString()).toBe("2026-09-28T00:00:00.000Z");
  });

  it("ends (exclusive) exactly 7 days after the start", () => {
    expect(PLANNED_ARRIVAL_WINDOW_DAYS).toBe(7);
    expect(window.to.getTime() - window.from.getTime()).toBe(7 * DAY_MS);
    expect(window.to.toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });

  it("includes the start of the 7th calendar day (today + 6)", () => {
    expect(inWindow(new Date("2026-09-28T00:00:00.000Z"), window)).toBe(true);
    expect(inWindow(new Date("2026-10-04T00:00:00.000Z"), window)).toBe(true);
  });

  it("excludes a date exactly at endExclusive (today + 7)", () => {
    expect(inWindow(new Date("2026-10-05T00:00:00.000Z"), window)).toBe(false);
  });

  it("uses the UTC day even just before UTC midnight", () => {
    const lateWindow = getPlannedArrivalWindow(new Date("2026-09-28T23:59:59.999Z"));
    expect(lateWindow.from.toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(lateWindow.to.toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });
});
