export type ChartAccent = "mint" | "blue" | "amber" | "rose";

/** Stable key into dictionary.commandCenter.inventoryStatus.segments — the segment's label is never stored here. */
export type InventorySegmentKey = "inStock" | "reserved" | "inTransit" | "lowStock";

/**
 * Presentation-only demo figures — never derived from a live query, so
 * value/trendValue/pct/points are never altered per locale (see the
 * Command Center localization audit). Month labels are stored as
 * 0-indexed `monthIndex` (matching Date's own convention, same as
 * components/ui/date-input.tsx) rather than a hardcoded English
 * abbreviation — the consuming component resolves the locale-correct
 * short month name via Intl.DateTimeFormat. The underlying nine-month
 * Jan-through-Sep demo sequence is unchanged, only how each month's name
 * is displayed.
 */
export const salesPerformance = {
  value: "24 580 000",
  unit: "UAH",
  trendValue: "+14%",
  months: [
    { monthIndex: 0, pct: 42 },
    { monthIndex: 1, pct: 55 },
    { monthIndex: 2, pct: 48 },
    { monthIndex: 3, pct: 63 },
    { monthIndex: 4, pct: 58 },
    { monthIndex: 5, pct: 70 },
    { monthIndex: 6, pct: 66 },
    { monthIndex: 7, pct: 80 },
    { monthIndex: 8, pct: 96 },
  ],
};

export const cashFlow = {
  value: "+3 120 000",
  unit: "UAH",
  /** September 2026 — same demo period as before, now structured instead of baked into a "Sep 2026" string. */
  monthIndex: 8,
  year: 2026,
  // Relative weekly values across the quarter — used only to draw the trend line.
  points: [22, 30, 26, 40, 34, 48, 42, 58, 52, 68, 60, 78],
};

export const inventoryStatus = {
  value: "8 420",
  segments: [
    { key: "inStock" as InventorySegmentKey, pct: 62, accent: "mint" as ChartAccent },
    { key: "reserved" as InventorySegmentKey, pct: 24, accent: "blue" as ChartAccent },
    { key: "inTransit" as InventorySegmentKey, pct: 8, accent: "amber" as ChartAccent },
    { key: "lowStock" as InventorySegmentKey, pct: 6, accent: "rose" as ChartAccent },
  ],
};

export const procurementNeeds = {
  value: "12",
  items: [
    { name: "Chicken Fillet", stockKg: 0, urgency: "critical" as const },
    { name: "Pork Neck", stockKg: 180, urgency: "warning" as const },
    { name: "Beef Trim 80/20", stockKg: 240, urgency: "warning" as const },
  ],
};
