import {
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
  | "grossMargin";

/**
 * No trend here on purpose: a trend is only shown once a real
 * previous-period comparison is computed (see KpiTrend in kpi-card.tsx).
 * The former hardcoded "+12%"-style placeholders looked like real data.
 */
export type KpiDatum = {
  id: KpiId;
  icon: LucideIcon;
  accent: KpiAccent;
};

/**
 * Only `id` selects a label, resolved against dictionary.commandCenter.kpi
 * by the caller — this file owns no presentation string. Values come from
 * getCommandCenterKpis.
 */
export const kpiData: KpiDatum[] = [
  {
    id: "cashBanks",
    icon: Landmark,
    accent: "mint",
  },
  {
    id: "receivables",
    icon: HandCoins,
    accent: "blue",
  },
  {
    id: "overdueAr",
    icon: TriangleAlert,
    accent: "rose",
  },
  {
    id: "payables",
    icon: CreditCard,
    accent: "violet",
  },
  {
    id: "grossMargin",
    icon: Percent,
    accent: "teal",
  },
];
