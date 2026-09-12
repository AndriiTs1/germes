export type ChartAccent = "mint" | "blue" | "amber" | "rose";

export const salesPerformance = {
  value: "24 580 000",
  unit: "UAH",
  trendValue: "+14%",
  comparisonLabel: "vs last month",
  months: [
    { label: "Jan", pct: 42 },
    { label: "Feb", pct: 55 },
    { label: "Mar", pct: 48 },
    { label: "Apr", pct: 63 },
    { label: "May", pct: 58 },
    { label: "Jun", pct: 70 },
    { label: "Jul", pct: 66 },
    { label: "Aug", pct: 80 },
    { label: "Sep", pct: 96 },
  ],
};

export const cashFlow = {
  value: "+3 120 000",
  unit: "UAH",
  secondaryLabel: "Net for Sep 2026",
  // Relative weekly values across the quarter — used only to draw the trend line.
  points: [22, 30, 26, 40, 34, 48, 42, 58, 52, 68, 60, 78],
};

export const inventoryStatus = {
  value: "8 420",
  secondaryLabel: "kg / units in stock",
  segments: [
    { label: "In stock", pct: 62, accent: "mint" as ChartAccent },
    { label: "Reserved", pct: 24, accent: "blue" as ChartAccent },
    { label: "In transit", pct: 8, accent: "amber" as ChartAccent },
    { label: "Low stock", pct: 6, accent: "rose" as ChartAccent },
  ],
};

export const procurementNeeds = {
  value: "12",
  secondaryLabel: "Items to reorder",
  items: [
    { name: "Chicken Fillet", stock: "Stock: 0 kg", urgency: "critical" as const },
    { name: "Pork Neck", stock: "Stock: 180 kg", urgency: "warning" as const },
    { name: "Beef Trim 80/20", stock: "Stock: 240 kg", urgency: "warning" as const },
  ],
};
