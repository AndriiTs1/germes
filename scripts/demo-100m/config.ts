/*
 * DEMO 100M data contract (v1) — every target the generator aims for and the
 * validator enforces. Monthly profiles are relative: index 0 = the oldest of
 * the 12 Kyiv calendar months ending with the as-of month, index 11 = the
 * (partial) as-of month.
 */

export const DATASET_VERSION = "DEMO-100M-v1";

/**
 * The one dataset --apply may write: this seed at this as-of must reproduce
 * this checksum exactly (any generator change that alters the data breaks it).
 */
export const CANONICAL = {
  seed: "DEMO-100M-v1",
  asOf: "2026-09-28T09:00:00.000Z", // 2026-09-28T12:00:00+03:00
  checksum: "6327ab92e308817b04f5bf1a65feb0dc47e1377232c8da375fbb4a916c899395",
} as const;

/** Production baseline the apply phase requires before its first write. */
export const PRODUCTION_BASELINE = {
  customers: 41,
  suppliers: 44,
  products: 42,
  warehouses: 2,
  salesUsers: 3,
  /** Pre-existing purchase orders that may be present (never touched). */
  allowedExistingPurchaseOrders: ["PO-2026-001"],
} as const;
export const DEMO_MARKER = "[DEMO-100M]";
export const AUDIT_DEMO_METADATA = { demo: "DEMO-100M", demoVersion: "v1" } as const;
export const PAYABLE_REFERENCE_PREFIX = "DEMO100M/RCV-";

/** Shipped UAH orders per relative month (exact). */
export const MONTHLY_UAH_ORDER_COUNTS = [104, 100, 106, 71, 74, 85, 93, 90, 86, 84, 91, 96] as const;
/** Shipped UAH revenue per relative month, in UAH (targets; ≈100.1M total). */
export const MONTHLY_UAH_REVENUE = [
  9_600_000, 9_300_000, 9_800_000, 6_600_000, 6_900_000, 7_900_000, 8_600_000, 8_300_000, 8_000_000, 7_800_000,
  8_400_000, 8_900_000,
] as const;

export const STATUS_COUNTS = {
  SHIPPED_UAH: 1080,
  SHIPPED_EUR: 12,
  DRAFT: 20,
  CONFIRMED: 20,
  PROCESSING: 12,
  READY: 12,
  CANCELLED: 28,
  COMPLETED: 0,
} as const;
export const TOTAL_SALES_ORDERS = 1184;

/** CONFIRMED reservation coverage mix. */
export const CONFIRMED_COVERAGE = { full: 10, partial: 5, none: 5 } as const;
export const CANCELLED_WITH_RELEASED_RESERVATIONS = 20;

/** Relative month indexes (0..11) that may carry EUR shipments: never the last two. */
export const EUR_MONTH_INDEXES = [2, 3, 4, 5, 6, 7, 7, 8, 8, 9, 9, 9] as const;
export const EUR_REVENUE_TARGET_CENTS = 14_000_000; // 140 000 EUR
export const EUR_CUSTOMER_CODES = ["CUST-029", "CUST-025"] as const;

/** UAH order-size bands: share of orders, [min, max] UAH. */
export const ORDER_SIZE_BANDS = [
  { share: 0.35, min: 20_000, max: 50_000 },
  { share: 0.5, min: 50_000, max: 150_000 },
  { share: 0.13, min: 150_000, max: 250_000 },
  { share: 0.02, min: 250_000, max: 600_000 },
] as const;
/** Items per order: weights for 1..5 lines (≈21 / 33 / 27 / 13 / 6 % → mean ≈ 2.5, a B2B wholesale mix). */
export const ITEM_COUNT_WEIGHTS = [21, 33, 27, 13, 6] as const;

/** Payment terms (days) → number of customers; 60 = the two EUR customers. */
export const PAYMENT_TERM_BUCKETS = [
  { days: 45, count: 2 },
  { days: 30, count: 5 },
  { days: 21, count: 8 },
  { days: 14, count: 12 },
  { days: 7, count: 8 },
  { days: 0, count: 4 },
] as const;
export const EUR_CUSTOMER_TERM_DAYS = 60;
export const CUSTOMERS_WITH_CREDIT_LIMIT = 30;

/**
 * Weight-assignment targets per sales manager. Tuned below the realized
 * ≈38 / 34 / 28 revenue shares because the recent key-account boost adds
 * volume to whichever manager holds the largest accounts.
 */
export const MANAGER_SHARE_TARGETS = { sales: 0.35, sales2: 0.35, sales3: 0.3 } as const;

/** Customer attention groups (sizes). */
export const ATTENTION_GROUPS = {
  active: 20,
  nextActionSoon: 5,
  nextActionOverdue: 5,
  staleContact: 4,
  stalePurchase: 4, // includes the two EUR customers
  noSignals: 3,
} as const;
export const STALE_CONTACT_DAYS = 21; // lib/services/sales/config.ts
export const STALE_PURCHASE_DAYS = 45; // lib/services/sales/config.ts

export const RESERVATION_TTL_HOURS = 24; // lib/services/sales/create-stock-reservation.ts

/** Ending stock groups: count and [min, max] kg per product. */
export const STOCK_GROUPS = [
  { name: "large", count: 8, min: 4_000, max: 9_000 },
  { name: "normal", count: 18, min: 1_500, max: 4_000 },
  { name: "low", count: 10, min: 300, max: 1_500 },
  { name: "almostZero", count: 4, min: 1, max: 99 },
  { name: "zero", count: 2, min: 0, max: 0 },
] as const;
export const PHYSICAL_STOCK_TARGET_KG = 95_000;
export const ACTIVE_RESERVED_TARGET_KG = 34_000;
export const CONSUMPTION_BATCH_KG = 3_450;
export const KYIV_SUPPLY_SHARE = 0.65;

/** Exact receivable status counts (UAH + EUR) and the fixed EUR part of them. */
export const RECEIVABLE_STATUS_TARGETS = { PAID: 960, OPEN: 88, PARTIALLY_PAID: 44 } as const;
export const EUR_RECEIVABLE_STATUSES = { PAID: 10, OPEN: 1, PARTIALLY_PAID: 1 } as const;
/** Share of PAID receivables settled in two payments instead of one. */
export const PAID_TWO_PAYMENTS_SHARE = 0.15;

/** Exact payable counts / statuses per currency (one payable = one supplier invoice). */
export const PAYABLE_STATUS_TARGETS = {
  UAH: { PAID: 92, PARTIALLY_PAID: 9, OPEN: 17 },
  EUR: { PAID: 8, PARTIALLY_PAID: 1, OPEN: 3 },
} as const;
/** Deliveries received this recently are invoiced one batch at a time (never merged). */
export const SINGLE_INVOICE_RECENT_DAYS = 40;

/** Receivable targets (UAH minor units unless noted). */
export const AR_TARGETS = {
  openUah: 1_200_000_000,
  overdueUah: 260_000_000,
  overdueDocs: 30,
  openEurCents: 1_800_000,
};
/** Payable targets. */
export const AP_TARGETS = { openUah: 750_000_000, openEurCents: 4_500_000 };

export const PURCHASE_ORDER_PLAN = {
  confirmed: { uah: 13, eur: 3 },
  draft: { uah: 7, eur: 2 },
  cancelled: { uah: 20, eur: 0 },
} as const;
/** Suppliers actively used: 11 domestic (UAH) + 4 import (EUR). */
export const UAH_SUPPLIER_CODES = [
  "SUP-023", "SUP-025", "SUP-026", "SUP-027", "SUP-028", "SUP-030", "SUP-031", "SUP-033", "SUP-039", "SUP-040", "SUP-041",
] as const;
export const EUR_SUPPLIER_CODES = ["SUP-004", "SUP-007", "SUP-009", "SUP-021"] as const;
/** Imported products invoiced in EUR by the EUR suppliers. */
export const EUR_SOURCED_SKUS = ["PORK-013", "PORK-023", "PORK-016"] as const;

/** Validation ranges (hard). */
export const RANGES = {
  uahRevenue: [99_000_000_00, 102_000_000_00],
  uahRevenuePreferred: [99_900_000_00, 100_300_000_00],
  trendPct: [5, 8],
  eurRevenueCents: [135_000_00, 145_000_00],
  openArUah: [11_500_000_00, 12_500_000_00],
  overdueArUah: [2_400_000_00, 2_800_000_00],
  overdueDocs: [25, 35],
  openArEurCents: [17_000_00, 19_000_00],
  openApUah: [7_000_000_00, 8_000_000_00],
  openApEurCents: [42_000_00, 48_000_00],
  physicalKg: [92_000, 98_000],
  reservedKg: [32_000, 36_000],
  batches: [280, 320],
  /** Every lifecycle event of every demo order, as the real services write them. */
  auditLogs: [13_000, 16_000],
  paymentEvents: [1_100, 1_250],
  itemsPerOrder: [2.4, 2.6],
  managerShare: [0.25, 0.4],
} as const;

// ---------------------------------------------------------------------------
// Product catalogue semantics (shared by the generator and the price validator)
// ---------------------------------------------------------------------------

export type ProductKind = "fat" | "offal" | "chicken" | "pork" | "beef";
const OFFAL_WORDS = ["Печінка", "Серце", "Нирки", "Легені", "Язик", "Вуха", "Діафрагма", "Шкіра", "Жилка", "Каркас", "Шия куряча", "ММО", "Баки"];

/** UAH/kg bands by product kind (chicken 30–150, pork 130–220, beef 220–320, offal 40–120, fat 40–80). */
export const PRICE_BANDS_UAH: Record<ProductKind, readonly [number, number]> = {
  fat: [40, 80],
  offal: [40, 120],
  chicken: [30, 150],
  pork: [130, 220],
  beef: [220, 320],
};
/** EUR/kg band for the imported, EUR-invoiced products. */
export const PRICE_BAND_EUR: readonly [number, number] = [3.6, 5.8];
/** Line prices may deviate from a band by the customer factor (±8 %) and the yearly drift (±3 %). */
export const PRICE_TOLERANCE = { low: 0.92 * 0.97, high: 1.08 * 1.03 } as const;

export function productKind(name: string, category: string): ProductKind {
  if (name.includes("Жир") || name.includes("Сало")) return "fat";
  if (OFFAL_WORDS.some((w) => name.includes(w))) return "offal";
  if (category === "Свинина") return "pork";
  if (category === "Яловичина") return "beef";
  return "chicken";
}
