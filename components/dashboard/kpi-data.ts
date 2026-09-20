import {
  Boxes,
  CreditCard,
  HandCoins,
  Landmark,
  Percent,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

export type KpiAccent = "mint" | "blue" | "rose" | "violet" | "amber" | "teal";
export type KpiTrendDirection = "up" | "down";
export type KpiTrendSentiment = "positive" | "negative" | "neutral";

/** Stable key into dictionary.commandCenter.kpi — the card's label is never stored here. */
export type KpiId =
  | "cashBanks"
  | "receivables"
  | "overdueAr"
  | "payables"
  | "inventoryValue"
  | "grossMargin";

export type KpiDatum = {
  id: KpiId;
  trendValue: string;
  trendDirection: KpiTrendDirection;
  /**
   * Whether this trend is good, bad, or merely informational for the
   * business — independent of the raw +/- direction. Drives trend color.
   */
  trendSentiment: KpiTrendSentiment;
  icon: LucideIcon;
  accent: KpiAccent;
};

/**
 * Presentation-only demo figures (value/trendValue) — never derived from a
 * live query, so they are never reformatted or altered per locale (see the
 * Command Center localization audit). Only `id` selects a label, resolved
 * against dictionary.commandCenter.kpi by the caller — this file owns no
 * English (or any other language) presentation string.
 */
export const kpiData: KpiDatum[] = [
  {
    id: "cashBanks",
    trendValue: "+12%",
    trendDirection: "up",
    trendSentiment: "positive",
    icon: Landmark,
    accent: "mint",
  },
  {
    id: "receivables",
    trendValue: "+18%",
    trendDirection: "up",
    trendSentiment: "neutral",
    icon: HandCoins,
    accent: "blue",
  },
  {
    id: "overdueAr",
    trendValue: "+24%",
    trendDirection: "up",
    trendSentiment: "negative",
    icon: TriangleAlert,
    accent: "rose",
  },
  {
    id: "payables",
    trendValue: "-8%",
    trendDirection: "down",
    trendSentiment: "positive",
    icon: CreditCard,
    accent: "violet",
  },
  {
    id: "inventoryValue",
    trendValue: "+6%",
    trendDirection: "up",
    trendSentiment: "neutral",
    icon: Boxes,
    accent: "amber",
  },
  {
    id: "grossMargin",
    trendValue: "+2.6 pp",
    trendDirection: "up",
    trendSentiment: "positive",
    icon: Percent,
    accent: "teal",
  },
];
