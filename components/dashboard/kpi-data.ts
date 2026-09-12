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

export type KpiDatum = {
  id: string;
  label: string;
  value: string;
  unit?: string;
  trendValue: string;
  trendDirection: KpiTrendDirection;
  /**
   * Whether this trend is good, bad, or merely informational for the
   * business — independent of the raw +/- direction. Drives trend color.
   */
  trendSentiment: KpiTrendSentiment;
  comparisonLabel: string;
  icon: LucideIcon;
  accent: KpiAccent;
};

export const kpiData: KpiDatum[] = [
  {
    id: "cash-banks",
    label: "Cash & Banks",
    value: "12 480 000",
    unit: "UAH",
    trendValue: "+12%",
    trendDirection: "up",
    trendSentiment: "positive",
    comparisonLabel: "vs last month",
    icon: Landmark,
    accent: "mint",
  },
  {
    id: "receivables",
    label: "Receivables",
    value: "8 230 000",
    unit: "UAH",
    trendValue: "+18%",
    trendDirection: "up",
    trendSentiment: "neutral",
    comparisonLabel: "vs last month",
    icon: HandCoins,
    accent: "blue",
  },
  {
    id: "overdue-ar",
    label: "Overdue AR",
    value: "2 340 000",
    unit: "UAH",
    trendValue: "+24%",
    trendDirection: "up",
    trendSentiment: "negative",
    comparisonLabel: "vs last month",
    icon: TriangleAlert,
    accent: "rose",
  },
  {
    id: "payables",
    label: "Payables",
    value: "3 120 000",
    unit: "UAH",
    trendValue: "-8%",
    trendDirection: "down",
    trendSentiment: "positive",
    comparisonLabel: "vs last month",
    icon: CreditCard,
    accent: "violet",
  },
  {
    id: "inventory-value",
    label: "Inventory Value",
    value: "15 640 000",
    unit: "UAH",
    trendValue: "+6%",
    trendDirection: "up",
    trendSentiment: "neutral",
    comparisonLabel: "vs last month",
    icon: Boxes,
    accent: "amber",
  },
  {
    id: "gross-margin",
    label: "Gross Margin",
    value: "18.4%",
    trendValue: "+2.6 pp",
    trendDirection: "up",
    trendSentiment: "positive",
    comparisonLabel: "vs last month",
    icon: Percent,
    accent: "teal",
  },
];
