import {
  ACTIVE_RESERVED_TARGET_KG,
  AP_TARGETS,
  AR_TARGETS,
  ATTENTION_GROUPS,
  AUDIT_DEMO_METADATA,
  CANCELLED_WITH_RELEASED_RESERVATIONS,
  CONFIRMED_COVERAGE,
  CONSUMPTION_BATCH_KG,
  CUSTOMERS_WITH_CREDIT_LIMIT,
  DATASET_VERSION,
  DEMO_MARKER,
  EUR_CUSTOMER_CODES,
  EUR_CUSTOMER_TERM_DAYS,
  EUR_MONTH_INDEXES,
  EUR_REVENUE_TARGET_CENTS,
  EUR_SOURCED_SKUS,
  EUR_SUPPLIER_CODES,
  ITEM_COUNT_WEIGHTS,
  KYIV_SUPPLY_SHARE,
  MANAGER_SHARE_TARGETS,
  MONTHLY_UAH_ORDER_COUNTS,
  MONTHLY_UAH_REVENUE,
  ORDER_SIZE_BANDS,
  PAYABLE_REFERENCE_PREFIX,
  PAID_TWO_PAYMENTS_SHARE,
  PAYABLE_STATUS_TARGETS,
  PRICE_BAND_EUR,
  PRICE_BANDS_UAH,
  productKind,
  type ProductKind,
  RANGES,
  RECEIVABLE_STATUS_TARGETS,
  EUR_RECEIVABLE_STATUSES,
  SINGLE_INVOICE_RECENT_DAYS,
  PAYMENT_TERM_BUCKETS,
  PHYSICAL_STOCK_TARGET_KG,
  PURCHASE_ORDER_PLAN,
  RESERVATION_TTL_HOURS,
  STATUS_COUNTS,
  STOCK_GROUPS,
  UAH_SUPPLIER_CODES,
} from "./config";
import {
  addMonths,
  BUSINESS_TIME_ZONE,
  createRng,
  DAY,
  daysInMonth,
  demoId,
  fromKyiv,
  HOUR,
  kyivMonthOf,
  toKyiv,
  type Rng,
  type YearMonth,
} from "./lib";
import { CUSTOMERS, PRODUCTS, WAREHOUSE_CODES, type SalesManagerKey } from "./master-data";
import type {
  AuditLog,
  Batch,
  Currency,
  CustomerUpdate,
  DemoDataset,
  Payable,
  PaymentEvent,
  PurchaseOrder,
  Receivable,
  SalesOrder,
  SalesOrderItem,
  SalesOrderStatus,
  StockMovement,
  StockReservation,
  SupplierUpdate,
  UserKey,
} from "./types";

export type GenerateOptions = { asOf: Date; seed: string };

/** In-key-accounts share boost for orders shipped in the last 45 days (drives the not-yet-due receivables). */
const RECENT_KEY_ACCOUNT_BOOST = 5.5;
/** Batch count the consumption batch size is solved for (validator range 280–320). */
const TARGET_BATCHES = 300;

const iso = (ms: number) => new Date(ms).toISOString();

// ---------------------------------------------------------------------------
// Product catalogue semantics
// ---------------------------------------------------------------------------

/** Sales mix: meat cuts dominate a distributor's volume; offal and fat are the cheap tail. */
const POPULARITY_BY_KIND: Record<ProductKind, number> = { pork: 3, beef: 2.6, chicken: 1, offal: 0.7, fat: 0.5 };
/** Relative demand of the EUR-invoiced import SKUs (keeps EUR purchasing ≈ a few hundred thousand EUR a year). */
const EUR_IMPORT_POPULARITY = 0.35;

type ProductPlan = {
  sku: string;
  kind: ProductKind;
  /** Base UAH price per kg in kopecks. */
  basePrice: number;
  /** EUR price per kg in cents (EUR-sourced only). */
  eurPrice: number | null;
  popularity: number;
  stockGroup: (typeof STOCK_GROUPS)[number]["name"];
  supplierCodes: string[];
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateDataset({ asOf, seed }: GenerateOptions): DemoDataset {
  const asOfMs = asOf.getTime();
  const rng = (label: string) => createRng(seed, label);
  const asOfMonth = kyivMonthOf(asOf);
  const months: YearMonth[] = Array.from({ length: 12 }, (_, i) => addMonths(asOfMonth, i - 11));
  const audit: AuditLog[] = [];
  let auditSeq = 0;
  const log = (entry: Omit<AuditLog, "id" | "metadata"> & { metadata: Record<string, unknown> }) => {
    auditSeq += 1;
    audit.push({ ...entry, id: demoId("auditLog", auditSeq), metadata: { ...entry.metadata, ...AUDIT_DEMO_METADATA } });
  };

  /** A Kyiv working-hours instant on a given Kyiv day (08:00–17:59). */
  const workTime = (r: Rng, ym: YearMonth, day: number) => fromKyiv(ym.year, ym.month, day, r.int(8, 17), r.int(0, 59)).getTime();

  // ---- Products -----------------------------------------------------------
  const productRng = rng("products");
  const productPlans: ProductPlan[] = PRODUCTS.map((p) => {
    const kind = productKind(p.name, p.category);
    const [lo, hi] = PRICE_BANDS_UAH[kind];
    const isEur = (EUR_SOURCED_SKUS as readonly string[]).includes(p.sku);
    return {
      sku: p.sku,
      kind,
      basePrice: Math.round(productRng.float(lo + (hi - lo) * 0.15, hi - (hi - lo) * 0.1) * 100),
      eurPrice: isEur ? Math.round(productRng.float(PRICE_BAND_EUR[0], PRICE_BAND_EUR[1]) * 100) : null,
      // EUR imports are a niche line next to the domestic range.
      popularity: productRng.float(0.4, 1) * POPULARITY_BY_KIND[kind] * (isEur ? EUR_IMPORT_POPULARITY : 1),
      stockGroup: "normal",
      supplierCodes: [],
    };
  });
  // Stock groups by popularity rank (best sellers carry the largest stock).
  const byPopularity = [...productPlans].sort((a, b) => b.popularity - a.popularity || (a.sku < b.sku ? -1 : 1));
  {
    let offset = 0;
    for (const group of STOCK_GROUPS) {
      for (const p of byPopularity.slice(offset, offset + group.count)) p.stockGroup = group.name;
      offset += group.count;
    }
  }
  // Suppliers per product: EUR-sourced from one EUR supplier, the rest from one or two domestic suppliers.
  {
    const r = rng("productSuppliers");
    let eurIndex = 0;
    productPlans.forEach((p, i) => {
      if (p.eurPrice !== null) {
        p.supplierCodes = [EUR_SUPPLIER_CODES[eurIndex++ % EUR_SUPPLIER_CODES.length]];
      } else {
        const primary = UAH_SUPPLIER_CODES[i % UAH_SUPPLIER_CODES.length];
        const secondary = r.pick(UAH_SUPPLIER_CODES);
        p.supplierCodes = r.next() < 0.3 && secondary !== primary ? [primary, secondary] : [primary];
      }
    });
  }
  const productBySku = new Map(productPlans.map((p) => [p.sku, p]));
  const stockableSkus = productPlans.filter((p) => p.stockGroup === "large" || p.stockGroup === "normal").map((p) => p.sku);

  // ---- Customers ----------------------------------------------------------
  const custRng = rng("customers");
  const eurCustomers = new Set<string>(EUR_CUSTOMER_CODES);
  const uahCustomers = CUSTOMERS.filter((c) => !eurCustomers.has(c.code));
  // Revenue weights, largest first: 7 key accounts, 8 medium, 12 regular, 8 small, 4 micro.
  const tierWeights = [
    0.17, 0.15, 0.075, 0.07, 0.065, 0.06, 0.055, ...Array(8).fill(0.028), ...Array(12).fill(0.012), ...Array(8).fill(0.006),
    ...Array(4).fill(0.004),
  ] as number[];
  // Assign weights to customers so each manager's share tracks its target.
  const weightByCustomer = new Map<string, number>();
  const rankByCustomer = new Map<string, number>();
  {
    const assigned: Record<SalesManagerKey, number> = { sales: 0, sales2: 0, sales3: 0 };
    const pools: Record<SalesManagerKey, string[]> = { sales: [], sales2: [], sales3: [] };
    for (const c of uahCustomers) pools[c.responsible].push(c.code);
    const total = tierWeights.reduce((s, w) => s + w, 0);
    tierWeights.forEach((w, rank) => {
      const manager = (Object.keys(pools) as SalesManagerKey[])
        .filter((m) => pools[m].length > 0)
        .sort((a, b) => MANAGER_SHARE_TARGETS[b] - assigned[b] / total - (MANAGER_SHARE_TARGETS[a] - assigned[a] / total))[0];
      const code = pools[manager].shift()!;
      assigned[manager] += w;
      weightByCustomer.set(code, w);
      rankByCustomer.set(code, rank);
    });
  }
  const uahByRank = [...uahCustomers].sort((a, b) => rankByCustomer.get(a.code)! - rankByCustomer.get(b.code)!);
  const termByCustomer = new Map<string, number>();
  {
    let i = 0;
    for (const bucket of PAYMENT_TERM_BUCKETS) {
      for (let k = 0; k < bucket.count; k++) termByCustomer.set(uahByRank[i++].code, bucket.days);
    }
    for (const code of EUR_CUSTOMER_CODES) termByCustomer.set(code, EUR_CUSTOMER_TERM_DAYS);
  }
  const keyAccounts = new Set(uahByRank.slice(0, 7).map((c) => c.code));
  // Attention groups. Two micro UAH customers + both EUR customers stop buying (stale purchase).
  const groupByCustomer = new Map<string, CustomerUpdate["attentionGroup"]>();
  const staleUah = uahByRank.slice(-2).map((c) => c.code);
  for (const code of [...EUR_CUSTOMER_CODES, ...staleUah]) groupByCustomer.set(code, "stalePurchase");
  {
    const rest = custRng.shuffle(uahCustomers.filter((c) => !staleUah.includes(c.code)).map((c) => c.code));
    const plan: [CustomerUpdate["attentionGroup"], number][] = [
      ["nextActionSoon", ATTENTION_GROUPS.nextActionSoon],
      ["nextActionOverdue", ATTENTION_GROUPS.nextActionOverdue],
      ["staleContact", ATTENTION_GROUPS.staleContact],
      ["noSignals", ATTENTION_GROUPS.noSignals],
      ["active", ATTENTION_GROUPS.active],
    ];
    let i = 0;
    for (const [group, count] of plan) for (let k = 0; k < count; k++) groupByCustomer.set(rest[i++], group);
  }
  const responsibleByCustomer = new Map(CUSTOMERS.map((c) => [c.code, c.responsible]));
  const recentBuyers = uahCustomers.filter((c) => groupByCustomer.get(c.code) !== "stalePurchase").map((c) => c.code);

  // ---- Shipped UAH orders -------------------------------------------------
  type Draft = {
    key: string;
    status: SalesOrderStatus;
    currency: Currency;
    customerCode: string;
    orderMs: number;
    shippedMs: number | null;
    targetAmount: number; // minor units
    monthIndex: number | null;
    items: { sku: string; quantityKg: number; pricePerKg: number }[];
    timeline?: { confirm: number; reserve: number; start: number; ready: number };
  };
  const drafts: Draft[] = [];
  const shipRng = rng("shippedUah");
  const recentFrom = asOfMs - 45 * DAY;

  const pickCustomer = (r: Rng, atMs: number, pool: string[]) => {
    const weights = pool.map((code) => {
      let w = weightByCustomer.get(code) ?? 0.01;
      if (atMs >= recentFrom && keyAccounts.has(code)) w *= RECENT_KEY_ACCOUNT_BOOST * ((termByCustomer.get(code) ?? 0) >= 45 ? 2 : 1);
      if (staleUah.includes(code) && atMs > asOfMs - 50 * DAY) w = 0;
      return w;
    });
    return pool[r.weightedIndex(weights)];
  };

  const drawSize = (r: Rng) => {
    const band = ORDER_SIZE_BANDS[r.weightedIndex(ORDER_SIZE_BANDS.map((b) => b.share))];
    return r.float(band.min, band.max);
  };

  const asOfKyiv = toKyiv(asOf);
  months.forEach((ym, monthIndex) => {
    const count = MONTHLY_UAH_ORDER_COUNTS[monthIndex];
    const isCurrent = monthIndex === 11;
    const lastOrderDay = isCurrent ? asOfKyiv.day - 3 : daysInMonth(ym) - 2;
    const sizes = Array.from({ length: count }, () => drawSize(shipRng));
    const scale = MONTHLY_UAH_REVENUE[monthIndex] / sizes.reduce((s, v) => s + v, 0);
    for (let k = 0; k < count; k++) {
      const day = shipRng.int(1, lastOrderDay);
      const orderMs = workTime(shipRng, ym, day);
      drafts.push({
        key: `uah-${monthIndex}-${k}`,
        status: "SHIPPED",
        currency: "UAH",
        customerCode: pickCustomer(shipRng, orderMs + DAY, recentBuyers.concat(staleUah)),
        orderMs,
        shippedMs: null,
        targetAmount: Math.round(sizes[k] * scale * 100),
        monthIndex,
        items: [],
      });
    }
  });

  // Guarantees behind the attention groups: every recent buyer shipped in the
  // last 40 days; each stale UAH customer's last shipment is 50–90 days ago.
  {
    const r = rng("coverage");
    const inWindow = (d: Draft, from: number, to: number) => d.orderMs >= from && d.orderMs < to;
    const recent = drafts.filter((d) => inWindow(d, asOfMs - 38 * DAY, asOfMs));
    const counts = new Map<string, number>();
    for (const d of recent) counts.set(d.customerCode, (counts.get(d.customerCode) ?? 0) + 1);
    for (const code of recentBuyers) {
      if (counts.get(code)) continue;
      const donor = recent
        .filter((d) => (counts.get(d.customerCode) ?? 0) > 1)
        .sort((a, b) => (counts.get(b.customerCode) ?? 0) - (counts.get(a.customerCode) ?? 0) || (a.key < b.key ? -1 : 1))[0];
      counts.set(donor.customerCode, (counts.get(donor.customerCode) ?? 0) - 1);
      donor.customerCode = code;
      counts.set(code, 1);
    }
    for (const code of staleUah) {
      if (drafts.some((d) => d.customerCode === code && inWindow(d, asOfMs - 88 * DAY, asOfMs - 52 * DAY))) continue;
      const candidates = drafts.filter(
        (d) => d.currency === "UAH" && inWindow(d, asOfMs - 88 * DAY, asOfMs - 52 * DAY) && !staleUah.includes(d.customerCode),
      );
      candidates[r.int(0, candidates.length - 1)].customerCode = code;
    }
  }

  // Big accounts place the big orders: within each month, the recent (last
  // 45 days) orders' target amounts are re-paired so the largest go to the
  // customers with the longest payment terms. Month totals are unchanged.
  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const recent = drafts.filter((d) => d.monthIndex === monthIndex && d.currency === "UAH" && d.orderMs >= recentFrom);
    if (recent.length < 2) continue;
    const amounts = recent.map((d) => d.targetAmount).sort((a, b) => b - a);
    const byTerm = [...recent].sort(
      (a, b) =>
        (termByCustomer.get(b.customerCode) ?? 0) - (termByCustomer.get(a.customerCode) ?? 0) ||
        (weightByCustomer.get(b.customerCode) ?? 0) - (weightByCustomer.get(a.customerCode) ?? 0) ||
        (a.key < b.key ? -1 : 1),
    );
    byTerm.forEach((d, i) => {
      d.targetAmount = amounts[i];
    });
  }

  // Keep each sales manager's revenue share inside 27–39 %: move older
  // orders (before the recent window, so the attention guarantees above
  // stay intact) from the heaviest manager's customers to the lightest's.
  {
    const r = rng("managerBalance");
    const movable = drafts.filter((d) => d.currency === "UAH" && d.orderMs < recentFrom - 10 * DAY && d.orderMs < asOfMs - 95 * DAY);
    const customersOf = (m: SalesManagerKey) => recentBuyers.filter((code) => responsibleByCustomer.get(code) === m);
    for (let guard = 0; guard < 400; guard++) {
      const totals: Record<SalesManagerKey, number> = { sales: 0, sales2: 0, sales3: 0 };
      for (const d of drafts) if (d.currency === "UAH") totals[responsibleByCustomer.get(d.customerCode)!] += d.targetAmount;
      const sum = totals.sales + totals.sales2 + totals.sales3;
      const managers = (Object.keys(totals) as SalesManagerKey[]).sort((a, b) => totals[b] - totals[a]);
      const [heavy, , light] = managers;
      if (totals[heavy] / sum <= 0.39 && totals[light] / sum >= 0.27) break;
      const donors = movable.filter((d) => responsibleByCustomer.get(d.customerCode) === heavy);
      if (donors.length === 0) break;
      const moved = donors[r.int(0, donors.length - 1)];
      const pool = customersOf(light);
      moved.customerCode = pool[r.weightedIndex(pool.map((code) => weightByCustomer.get(code) ?? 0.01))];
    }
  }

  // ---- Shipped EUR orders -------------------------------------------------
  {
    const r = rng("shippedEur");
    const lastIndex = EUR_MONTH_INDEXES.length - 1;
    const weights = EUR_MONTH_INDEXES.map(() => r.float(0.8, 1.2));
    const lastAmount = 1_200_000; // 12 000 EUR — stays open, not yet due
    const restTotal = EUR_REVENUE_TARGET_CENTS - lastAmount;
    const restWeight = weights.slice(0, lastIndex).reduce((s, w) => s + w, 0);
    EUR_MONTH_INDEXES.forEach((monthIndex, k) => {
      const ym = months[monthIndex];
      const isLast = k === lastIndex;
      const day = isLast ? daysInMonth(ym) : r.int(2, daysInMonth(ym) - 3);
      const orderMs = isLast ? fromKyiv(ym.year, ym.month, day, 9, 0).getTime() - 30 * HOUR : workTime(r, ym, day);
      drafts.push({
        key: `eur-${k}`,
        status: "SHIPPED",
        currency: "EUR",
        customerCode: EUR_CUSTOMER_CODES[k % 2],
        orderMs,
        shippedMs: null,
        targetAmount: isLast ? lastAmount : Math.round((restTotal * weights[k]) / restWeight),
        monthIndex,
        items: [],
      });
    });
  }

  // ---- Items for shipped orders -------------------------------------------
  const drift = (ms: number) => 1 + 0.06 * ((ms - (asOfMs - 365 * DAY)) / (365 * DAY)) - 0.03;
  const customerFactor = new Map(CUSTOMERS.map((c) => [c.code, createRng(seed, `cf:${c.code}`).float(0.92, 1.08)]));
  const priceFor = (sku: string, currency: Currency, customerCode: string, ms: number) => {
    const p = productBySku.get(sku)!;
    const base = currency === "EUR" ? p.eurPrice! : p.basePrice;
    return Math.round(base * customerFactor.get(customerCode)! * drift(ms));
  };
  const itemsFor = (r: Rng, d: Draft, skuPool: string[], weightsOf: (sku: string) => number) => {
    const count = Math.min(skuPool.length, 1 + r.weightedIndex(ITEM_COUNT_WEIGHTS as unknown as number[]));
    const chosen: string[] = [];
    while (chosen.length < count) {
      const candidates = skuPool.filter((s) => !chosen.includes(s));
      chosen.push(candidates[r.weightedIndex(candidates.map(weightsOf))]);
    }
    const shares = chosen.map(() => r.float(0.5, 1.5));
    const shareTotal = shares.reduce((s, v) => s + v, 0);
    d.items = chosen.map((sku, i) => {
      const pricePerKg = priceFor(sku, d.currency, d.customerCode, d.orderMs);
      const quantityKg = Math.max(1, Math.round((d.targetAmount * shares[i]) / shareTotal / pricePerKg));
      return { sku, quantityKg, pricePerKg };
    });
  };
  {
    const r = rng("items");
    const allSkus = productPlans.map((p) => p.sku);
    const pop = (sku: string) => productBySku.get(sku)!.popularity;
    for (const d of drafts) {
      if (d.currency === "EUR") itemsFor(r, d, [...EUR_SOURCED_SKUS], () => 1);
      else itemsFor(r, d, allSkus, pop);
    }
  }

  // ---- Timelines of shipped orders ----------------------------------------
  {
    const r = rng("timelines");
    for (const d of drafts) {
      const confirm = d.orderMs + r.float(0, 4) * HOUR;
      const reserve = confirm + r.float(0.1, 2) * HOUR;
      const start = reserve + r.float(0.5, 20) * HOUR;
      const ready = start + r.float(2, 8) * HOUR;
      const ship = ready + r.float(0.2, 12) * HOUR;
      d.timeline = { confirm, reserve, start, ready };
      d.shippedMs = Math.min(ship, asOfMs - HOUR);
    }
  }

  // ---- Active orders (CONFIRMED / PROCESSING / READY) ---------------------
  const activeRng = rng("active");
  const activePool = recentBuyers;
  const makeActive = (status: SalesOrderStatus, n: number, ageHours: [number, number]) => {
    for (let k = 0; k < n; k++) {
      const orderMs = asOfMs - activeRng.float(ageHours[0], ageHours[1]) * HOUR;
      const d: Draft = {
        key: `${status.toLowerCase()}-${k}`,
        status,
        currency: "UAH",
        customerCode: pickCustomer(activeRng, orderMs, activePool),
        orderMs,
        shippedMs: null,
        targetAmount: Math.round(activeRng.float(70_000, 160_000) * 100),
        monthIndex: null,
        items: [],
      };
      itemsFor(activeRng, d, stockableSkus, (sku) => productBySku.get(sku)!.popularity);
      drafts.push(d);
    }
  };
  makeActive("CONFIRMED", STATUS_COUNTS.CONFIRMED, [20, 60]);
  makeActive("PROCESSING", STATUS_COUNTS.PROCESSING, [30, 130]);
  makeActive("READY", STATUS_COUNTS.READY, [30, 130]);
  const confirmedDrafts = drafts.filter((d) => d.status === "CONFIRMED");
  const coverageByKey = new Map<string, number>();
  confirmedDrafts.forEach((d, i) => {
    coverageByKey.set(
      d.key,
      i < CONFIRMED_COVERAGE.full ? 1 : i < CONFIRMED_COVERAGE.full + CONFIRMED_COVERAGE.partial ? activeRng.float(0.4, 0.7) : 0,
    );
  });
  for (const d of drafts) if (d.status === "PROCESSING" || d.status === "READY") coverageByKey.set(d.key, 1);

  /** Planned kg to reserve per item (full, partial prefix, or none). */
  const plannedReservation = (d: Draft) => {
    const coverage = coverageByKey.get(d.key) ?? 0;
    const total = d.items.reduce((s, it) => s + it.quantityKg, 0);
    let remaining = Math.round(total * coverage);
    return d.items.map((it) => {
      const take = Math.min(it.quantityKg, remaining);
      remaining -= take;
      return take;
    });
  };
  // Scale active quantities so the reserved total lands on its target.
  {
    const activeDrafts = drafts.filter((d) => coverageByKey.has(d.key));
    const reserved = activeDrafts.reduce((s, d) => s + plannedReservation(d).reduce((a, b) => a + b, 0), 0);
    const factor = ACTIVE_RESERVED_TARGET_KG / reserved;
    for (const d of activeDrafts) for (const it of d.items) it.quantityKg = Math.max(1, Math.round(it.quantityKg * factor));
  }
  const reservedBySku = new Map<string, number>();
  for (const d of drafts) {
    if (!coverageByKey.has(d.key)) continue;
    plannedReservation(d).forEach((kg, i) => reservedBySku.set(d.items[i].sku, (reservedBySku.get(d.items[i].sku) ?? 0) + kg));
  }

  // ---- Ending stock targets per product -----------------------------------
  const endingBySku = new Map<string, number>();
  {
    const r = rng("endingStock");
    for (const group of STOCK_GROUPS) {
      const members = productPlans.filter((p) => p.stockGroup === group.name);
      members.forEach((p, i) => {
        const span = group.max - group.min;
        const base = group.min + Math.round((span * (i + 0.5)) / members.length);
        const jitter = group.max > 0 ? r.int(0, Math.max(0, Math.round(span / members.length / 3))) : 0;
        // Never below the stock the active reservations need (may then exceed the group's nominal max).
        const value = Math.max(Math.min(group.max, base + jitter), Math.ceil((reservedBySku.get(p.sku) ?? 0) * 1.1));
        endingBySku.set(p.sku, value);
      });
    }
    // Fit the large/normal groups so total physical ≈ target, staying inside each range and above reservations.
    const flexible = productPlans.filter((p) => p.stockGroup === "large" || p.stockGroup === "normal");
    for (let pass = 0; pass < 20; pass++) {
      const total = [...endingBySku.values()].reduce((s, v) => s + v, 0);
      const gap = PHYSICAL_STOCK_TARGET_KG - total;
      if (Math.abs(gap) < 50) break;
      const flexTotal = flexible.reduce((s, p) => s + endingBySku.get(p.sku)!, 0);
      for (const p of flexible) {
        const group = STOCK_GROUPS.find((g) => g.name === p.stockGroup)!;
        const floor = Math.max(group.min, Math.ceil((reservedBySku.get(p.sku) ?? 0) * 1.05));
        const current = endingBySku.get(p.sku)!;
        endingBySku.set(p.sku, Math.max(floor, Math.min(group.max, Math.round(current + (gap * current) / flexTotal))));
      }
    }
    // Distinct values: nudge duplicates by +1 kg (zero-stock products stay 0).
    const seen = new Set<number>();
    for (const p of [...productPlans].sort((a, b) => (a.sku < b.sku ? -1 : 1))) {
      let v = endingBySku.get(p.sku)!;
      if (v === 0) continue;
      while (seen.has(v)) v += 1;
      seen.add(v);
      endingBySku.set(p.sku, v);
    }
  }

  // ---- Batches & receipts --------------------------------------------------
  type Demand = { ms: number; draft: Draft; itemIndex: number; kg: number };
  const demandBySku = new Map<string, Demand[]>();
  for (const d of drafts) {
    if (d.status !== "SHIPPED") continue;
    d.items.forEach((it, itemIndex) => {
      const list = demandBySku.get(it.sku) ?? [];
      list.push({ ms: d.shippedMs!, draft: d, itemIndex, kg: it.quantityKg });
      demandBySku.set(it.sku, list);
    });
  }
  for (const list of demandBySku.values()) list.sort((a, b) => a.ms - b.ms || (a.draft.key < b.draft.key ? -1 : 1));

  const batches: Batch[] = [];
  const batchRng = rng("batches");
  const warehouseFor = () => (batchRng.next() < KYIV_SUPPLY_SHARE ? WAREHOUSE_CODES[0] : WAREHOUSE_CODES[1]);
  const newBatch = (sku: string, kg: number, receivedMs: number, index: number): Batch => {
    const p = productBySku.get(sku)!;
    const supplierCode = p.supplierCodes[index % p.supplierCodes.length];
    const production = receivedMs - batchRng.int(3, 14) * DAY;
    const k = toKyiv(new Date(receivedMs));
    const stamp = `${String(k.year).slice(2)}${String(k.month).padStart(2, "0")}${String(k.day).padStart(2, "0")}`;
    const cost = p.eurPrice === null ? Math.round(p.basePrice * 0.72 * drift(receivedMs) * batchRng.float(0.97, 1.03)) : null;
    return {
      id: demoId("batch", `${sku}:${index}`),
      batchNumber: `DM-${stamp}-${sku}-${String(index + 1).padStart(2, "0")}`,
      productSku: sku,
      warehouseCode: warehouseFor(),
      supplierCode,
      receivedKg: kg,
      receivedAt: iso(receivedMs),
      productionDate: iso(production),
      expiryDate: iso(production + 365 * DAY),
      unitCost: cost,
      status: "AVAILABLE",
      notes: `${DEMO_MARKER} ${DATASET_VERSION}`,
    };
  };

  // Consumption batch size: sized so the whole dataset lands on ≈TARGET_BATCHES
  // batches whatever the seed's shipped volume (CONSUMPTION_BATCH_KG is the
  // starting estimate). Stock batches: 2 for >5 t, 1 otherwise, ≤1 remnant.
  const consumptionBatchKg = (() => {
    const shippedBySku = productPlans.map((p) => (demandBySku.get(p.sku) ?? []).reduce((s, e) => s + e.kg, 0));
    const stockBatches = productPlans.reduce((s, p) => {
      const ending = endingBySku.get(p.sku)!;
      return s + (ending === 0 ? 0 : p.stockGroup === "almostZero" ? 1 : ending > 5_000 ? 2 : 1);
    }, 0);
    const countFor = (kg: number) => shippedBySku.reduce((s, v) => s + (v > 0 ? Math.max(1, Math.round(v / kg)) : 0), 0) + stockBatches;
    let kg = CONSUMPTION_BATCH_KG;
    for (let i = 0; i < 40 && Math.abs(countFor(kg) - TARGET_BATCHES) > 3; i++) kg *= countFor(kg) / TARGET_BATCHES;
    return kg;
  })();
  const consumptionQueue = new Map<string, Batch[]>();
  const stockBatchesBySku = new Map<string, Batch[]>();
  for (const p of [...productPlans].sort((a, b) => (a.sku < b.sku ? -1 : 1))) {
    const demand = demandBySku.get(p.sku) ?? [];
    const shipped = demand.reduce((s, e) => s + e.kg, 0);
    const ending = endingBySku.get(p.sku)!;
    const queue: Batch[] = [];
    let index = 0;
    let lastReceipt = -Infinity;
    if (shipped > 0) {
      const n = Math.max(1, Math.round(shipped / consumptionBatchKg));
      const weights = Array.from({ length: n }, () => batchRng.float(0.8, 1.2));
      const wTotal = weights.reduce((s, w) => s + w, 0);
      const sizes = weights.map((w) => Math.max(1, Math.floor((shipped * w) / wTotal)));
      sizes[n - 1] += shipped - sizes.reduce((s, v) => s + v, 0);
      // The almost-zero leftover stays in the last batch — decided below once its date is known.
      let consumedBefore = 0;
      let cursor = 0;
      let cumulative = 0;
      for (let b = 0; b < n; b++) {
        // First demand event that draws on this batch.
        while (cursor < demand.length && cumulative + demand[cursor].kg <= consumedBefore) cumulative += demand[cursor++].kg;
        const firstUse = demand[Math.min(cursor, demand.length - 1)].ms;
        let receivedMs = firstUse - batchRng.float(3, 10) * DAY;
        receivedMs = Math.max(receivedMs, lastReceipt + HOUR);
        lastReceipt = receivedMs;
        queue.push(newBatch(p.sku, sizes[b], receivedMs, index++));
        consumedBefore += sizes[b];
      }
    }
    const stock: Batch[] = [];
    if (p.stockGroup === "almostZero" && ending > 0 && queue.length > 0) {
      const last = queue[queue.length - 1];
      // Remnant of the last delivery if that batch is still fresh (>60 days of shelf life left); otherwise a small late delivery.
      if (new Date(last.expiryDate).getTime() > asOfMs + 90 * DAY) last.receivedKg += ending;
      else stock.push(newBatch(p.sku, ending, Math.min(asOfMs - 6 * DAY, Math.max(asOfMs - batchRng.float(6, 35) * DAY, lastReceipt + HOUR)), index++));
    } else if (ending > 0 && p.stockGroup === "almostZero") {
      stock.push(newBatch(p.sku, ending, asOfMs - batchRng.float(6, 35) * DAY, index++));
    }
    if (ending > 0 && p.stockGroup !== "almostZero") {
      const parts = ending > 5_000 ? 2 : 1;
      const first = parts === 2 ? Math.round(ending * batchRng.float(0.4, 0.6)) : ending;
      const sizes = parts === 2 ? [first, ending - first] : [ending];
      for (const size of sizes) {
        let receivedMs = asOfMs - batchRng.float(6, 35) * DAY;
        receivedMs = Math.min(asOfMs - 6 * DAY, Math.max(receivedMs, lastReceipt + HOUR));
        lastReceipt = receivedMs;
        stock.push(newBatch(p.sku, size, receivedMs, index++));
      }
    }
    consumptionQueue.set(p.sku, queue);
    stockBatchesBySku.set(p.sku, stock);
    batches.push(...queue, ...stock);
  }

  // ---- FIFO shipments: CONSUMED reservations + SHIPMENT movements ----------
  const reservations: StockReservation[] = [];
  const movements: StockMovement[] = [];
  const remainingByBatch = new Map(batches.map((b) => [b.id, b.receivedKg]));
  let reservationSeq = 0;
  const pendingShipments = new Map<string, Map<string, { batch: Batch; kg: number }>>(); // draft key → batch → kg
  const itemIdOf = (d: Draft, i: number) => demoId("salesOrderItem", `${d.key}:${i}`);
  const orderIdOf = (d: Draft) => demoId("salesOrder", d.key);
  const allocate = (sku: string, kg: number, sources: Batch[]) => {
    const parts: { batch: Batch; kg: number }[] = [];
    let need = kg;
    for (const batch of sources) {
      if (need === 0) break;
      const left = remainingByBatch.get(batch.id)!;
      if (left <= 0) continue;
      const take = Math.min(left, need);
      remainingByBatch.set(batch.id, left - take);
      parts.push({ batch, kg: take });
      need -= take;
    }
    if (need > 0) throw new Error(`Generator invariant: not enough stock for ${sku} (${need} kg short)`);
    return parts;
  };
  const allEvents = [...demandBySku.values()].flat().sort((a, b) => a.ms - b.ms || (a.draft.key < b.draft.key ? -1 : 1) || a.itemIndex - b.itemIndex);
  for (const e of allEvents) {
    const sku = e.draft.items[e.itemIndex].sku;
    for (const part of allocate(sku, e.kg, consumptionQueue.get(sku)!)) {
      reservationSeq += 1;
      reservations.push({
        id: demoId("reservation", reservationSeq),
        productSku: sku,
        batchId: part.batch.id,
        warehouseCode: part.batch.warehouseCode,
        salesOrderId: orderIdOf(e.draft),
        salesOrderItemId: itemIdOf(e.draft, e.itemIndex),
        quantityKg: part.kg,
        status: "CONSUMED",
        createdAt: iso(e.draft.timeline!.reserve),
        expiresAt: iso(e.draft.timeline!.reserve + RESERVATION_TTL_HOURS * HOUR),
        notes: DEMO_MARKER,
      });
      const perOrder = pendingShipments.get(e.draft.key) ?? new Map();
      const key = `${part.batch.id}:${part.batch.warehouseCode}`;
      const agg = perOrder.get(key) ?? { batch: part.batch, kg: 0 };
      agg.kg += part.kg;
      perOrder.set(key, agg);
      pendingShipments.set(e.draft.key, perOrder);
    }
  }

  // ---- ACTIVE reservations from real remaining stock ----------------------
  {
    const r = rng("activeReservations");
    for (const d of drafts) {
      if (!coverageByKey.has(d.key)) continue;
      const planned = plannedReservation(d);
      const createdMs =
        d.status === "CONFIRMED" ? asOfMs - r.float(2, 18) * HOUR : asOfMs - r.float(24, 5 * 24) * HOUR;
      d.orderMs = Math.min(d.orderMs, createdMs - r.float(0.5, 4) * HOUR);
      d.items.forEach((it, i) => {
        if (planned[i] <= 0) return;
        for (const part of allocate(it.sku, planned[i], stockBatchesBySku.get(it.sku)!)) {
          reservationSeq += 1;
          reservations.push({
            id: demoId("reservation", reservationSeq),
            productSku: it.sku,
            batchId: part.batch.id,
            warehouseCode: part.batch.warehouseCode,
            salesOrderId: orderIdOf(d),
            salesOrderItemId: itemIdOf(d, i),
            quantityKg: part.kg,
            status: "ACTIVE",
            createdAt: iso(createdMs),
            expiresAt: iso(createdMs + RESERVATION_TTL_HOURS * HOUR),
            notes: DEMO_MARKER,
          });
        }
      });
      d.timeline = {
        confirm: createdMs - r.float(0.1, 1) * HOUR,
        reserve: createdMs,
        start: createdMs + r.float(0.5, 6) * HOUR,
        ready: createdMs + r.float(7, 16) * HOUR,
      };
    }
  }

  // ---- DRAFT and CANCELLED orders -----------------------------------------
  {
    const r = rng("draftCancelled");
    const nonZeroSkus = productPlans.filter((p) => p.stockGroup !== "zero" && p.stockGroup !== "almostZero").map((p) => p.sku);
    for (let k = 0; k < STATUS_COUNTS.DRAFT; k++) {
      const d: Draft = {
        key: `draft-${k}`,
        status: "DRAFT",
        currency: "UAH",
        customerCode: pickCustomer(r, asOfMs, recentBuyers),
        orderMs: asOfMs - r.float(1, 7 * 24) * HOUR,
        shippedMs: null,
        targetAmount: Math.round(drawSize(r) * 100),
        monthIndex: null,
        items: [],
      };
      itemsFor(r, d, nonZeroSkus, (sku) => productBySku.get(sku)!.popularity);
      drafts.push(d);
    }
    for (let k = 0; k < STATUS_COUNTS.CANCELLED; k++) {
      const withReservations = k < CANCELLED_WITH_RELEASED_RESERVATIONS;
      const monthIndex = r.int(0, 11);
      const ym = months[monthIndex];
      const lastDay = monthIndex === 11 ? asOfKyiv.day - 1 : daysInMonth(ym);
      const orderMs = workTime(r, ym, r.int(1, lastDay));
      // Only products that already had stock when the order was placed can have been reserved.
      const available = nonZeroSkus.filter((sku) =>
        batches.some((b) => b.productSku === sku && new Date(b.receivedAt).getTime() < orderMs),
      );
      const d: Draft = {
        key: `cancelled-${k}`,
        status: "CANCELLED",
        currency: "UAH",
        customerCode: pickCustomer(r, orderMs, recentBuyers),
        orderMs,
        shippedMs: null,
        targetAmount: Math.round(drawSize(r) * 100),
        monthIndex: null,
        items: [],
      };
      itemsFor(r, d, available, (sku) => productBySku.get(sku)!.popularity);
      const confirm = orderMs + r.float(0.2, 3) * HOUR;
      d.timeline = { confirm, reserve: confirm + r.float(0.1, 2) * HOUR, start: 0, ready: 0 };
      if (withReservations) {
        d.items.forEach((it, i) => {
          const batch = batches
            .filter((b) => b.productSku === it.sku && new Date(b.receivedAt).getTime() < orderMs)
            .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0];
          reservationSeq += 1;
          reservations.push({
            id: demoId("reservation", reservationSeq),
            productSku: it.sku,
            batchId: batch.id,
            warehouseCode: batch.warehouseCode,
            salesOrderId: orderIdOf(d),
            salesOrderItemId: itemIdOf(d, i),
            quantityKg: it.quantityKg,
            status: "RELEASED",
            createdAt: iso(d.timeline!.reserve),
            expiresAt: iso(d.timeline!.reserve + RESERVATION_TTL_HOURS * HOUR),
            notes: DEMO_MARKER,
          });
        });
      }
      drafts.push(d);
    }
  }

  // ---- Order numbers & SalesOrder records ----------------------------------
  const ordered = [...drafts].sort((a, b) => a.orderMs - b.orderMs || (a.key < b.key ? -1 : 1));
  const seqByYear = new Map<number, number>();
  const numberByKey = new Map<string, string>();
  for (const d of ordered) {
    const year = toKyiv(new Date(d.orderMs)).year;
    const next = (seqByYear.get(year) ?? 0) + 1;
    seqByYear.set(year, next);
    numberByKey.set(d.key, `SO-${year}-${String(next).padStart(3, "0")}`);
  }
  const salesOrders: SalesOrder[] = ordered.map((d) => {
    const id = orderIdOf(d);
    const items: SalesOrderItem[] = d.items.map((it, i) => ({
      id: itemIdOf(d, i),
      salesOrderId: id,
      productSku: it.sku,
      quantityKg: it.quantityKg,
      pricePerKg: it.pricePerKg,
    }));
    return {
      id,
      orderNumber: numberByKey.get(d.key)!,
      customerCode: d.customerCode,
      responsible: responsibleByCustomer.get(d.customerCode)!,
      status: d.status,
      currency: d.currency,
      orderDate: iso(d.orderMs),
      shippedAt: d.shippedMs === null ? null : iso(d.shippedMs),
      createdAt: iso(d.orderMs),
      notes: DEMO_MARKER,
      items,
    };
  });
  const orderByKey = new Map(ordered.map((d, i) => [d.key, salesOrders[i]]));
  const amountOf = (o: SalesOrder) => o.items.reduce((s, it) => s + it.quantityKg * it.pricePerKg, 0);

  // Shipment movements (one per order × batch × warehouse, reference = order number).
  let movementSeq = 0;
  for (const d of ordered) {
    const perOrder = pendingShipments.get(d.key);
    if (!perOrder) continue;
    for (const { batch, kg } of perOrder.values()) {
      movementSeq += 1;
      movements.push({
        id: demoId("movement", movementSeq),
        type: "SHIPMENT",
        batchId: batch.id,
        fromWarehouseCode: batch.warehouseCode,
        toWarehouseCode: null,
        quantityKg: kg,
        reference: numberByKey.get(d.key)!,
        notes: DEMO_MARKER,
        createdAt: iso(d.shippedMs!),
      });
    }
  }
  for (const b of batches) {
    movementSeq += 1;
    movements.push({
      id: demoId("movement", movementSeq),
      type: "RECEIPT",
      batchId: b.id,
      fromWarehouseCode: null,
      toWarehouseCode: b.warehouseCode,
      quantityKg: b.receivedKg,
      reference: b.batchNumber,
      notes: DEMO_MARKER,
      createdAt: b.receivedAt,
    });
  }

  // ---- Receivables & payments ---------------------------------------------
  const receivables: Receivable[] = [];
  const paymentEvents: PaymentEvent[] = [];
  const payRng = rng("payments");
  const shippedOrders = salesOrders.filter((o) => o.status === "SHIPPED");
  const receivableByOrder = new Map<string, Receivable>();
  for (const [i, o] of shippedOrders.entries()) {
    const shippedMs = new Date(o.shippedAt!).getTime();
    const term = termByCustomer.get(o.customerCode)!;
    const r: Receivable = {
      id: demoId("receivable", i + 1),
      customerCode: o.customerCode,
      salesOrderId: o.id,
      amount: amountOf(o),
      paidAmount: 0,
      currency: o.currency,
      dueDate: iso(shippedMs + term * DAY),
      status: "OPEN",
      reference: o.orderNumber,
      notes: DEMO_MARKER,
      createdAt: o.shippedAt!,
    };
    receivables.push(r);
    receivableByOrder.set(o.id, r);
  }
  const due = (r: Receivable) => new Date(r.dueDate).getTime();
  const partialPaid = (r: Receivable, fraction: number) => Math.round(r.amount * fraction);
  // UAH statuses. Exact counts come from the contract (all minus the fixed
  // EUR part); the open / overdue amounts are steered only by WHICH invoices
  // stay unpaid and by the partial-payment fractions (30–70 %).
  {
    const uah = receivables.filter((r) => r.currency === "UAH");
    const unpaidCount =
      RECEIVABLE_STATUS_TARGETS.OPEN - EUR_RECEIVABLE_STATUSES.OPEN + (RECEIVABLE_STATUS_TARGETS.PARTIALLY_PAID - EUR_RECEIVABLE_STATUSES.PARTIALLY_PAID);
    const partialCount = RECEIVABLE_STATUS_TARGETS.PARTIALLY_PAID - EUR_RECEIVABLE_STATUSES.PARTIALLY_PAID;
    const notDue = uah.filter((r) => due(r) > asOfMs);
    const [minOverdue, maxOverdue] = RANGES.overdueDocs;
    const overdueCount = Math.min(maxOverdue, Math.max(minOverdue, unpaidCount - notDue.length));
    const overduePartial = Math.round(overdueCount * 0.4);
    const overdueOpen = overdueCount - overduePartial;
    const notDueUnpaid = Math.min(notDue.length, unpaidCount - overdueCount);
    const notDuePartial = partialCount - overduePartial;

    // Overdue: OPEN invoices near the per-document target, PARTIAL ones near twice it.
    const perDoc = AR_TARGETS.overdueUah / overdueCount;
    const pool = payRng
      .shuffle(uah.filter((r) => due(r) <= asOfMs && due(r) > asOfMs - 60 * DAY))
      .map((r, i) => ({ r, i }));
    const nearest = (target: number, n: number, taken: Set<Receivable>) =>
      pool
        .filter(({ r }) => !taken.has(r))
        .sort((a, b) => Math.abs(a.r.amount - target) - Math.abs(b.r.amount - target) || a.i - b.i)
        .slice(0, n)
        .map(({ r }) => r);
    const taken = new Set<Receivable>();
    const openOverdue = nearest(perDoc, overdueOpen, taken);
    openOverdue.forEach((r) => taken.add(r));
    const partialOverdue = nearest(perDoc * 2, overduePartial, taken);
    partialOverdue.forEach((r) => taken.add(r));
    for (const r of openOverdue) {
      r.paidAmount = 0;
      r.status = "OPEN";
    }
    // Paid fraction solved so the overdue outstanding lands on its target;
    // one 150–250k invoice is settled exactly half (the presentation example).
    {
      const showcase = partialOverdue.find((r) => r.amount >= 15_000_000 && r.amount <= 25_000_000);
      const others = partialOverdue.filter((r) => r !== showcase);
      const fixedOut = openOverdue.reduce((s, r) => s + r.amount, 0) + (showcase ? showcase.amount - Math.round(showcase.amount * 0.5) : 0);
      const othersTotal = others.reduce((s, r) => s + r.amount, 0);
      const outstandingShare = othersTotal > 0 ? (AR_TARGETS.overdueUah - fixedOut) / othersTotal : 0.5;
      if (showcase) {
        showcase.paidAmount = Math.round(showcase.amount * 0.5);
        showcase.status = "PARTIALLY_PAID";
      }
      for (const r of others) {
        const paidShare = Math.min(0.7, Math.max(0.3, 1 - outstandingShare + payRng.float(-0.04, 0.04)));
        r.paidAmount = partialPaid(r, paidShare);
        r.status = "PARTIALLY_PAID";
      }
    }
    const overdueOutstanding = [...openOverdue, ...partialOverdue].reduce((s, r) => s + r.amount - r.paidAmount, 0);

    // Not yet due: choose which invoices were paid early (a contiguous window
    // by amount) and which unpaid ones carry an advance payment (another
    // window by amount) so the required reduction sits inside 30–70 % of the
    // partially paid total, as close to its middle as possible.
    const byAmount = [...notDue].sort((a, b) => a.amount - b.amount || (a.id < b.id ? -1 : 1));
    const earlyCount = notDue.length - notDueUnpaid;
    const targetNotDue = AR_TARGETS.openUah - overdueOutstanding;
    type Plan = { early: Receivable[]; partial: Receivable[]; reduction: number; score: number };
    let best: Plan | null = null;
    for (let offset = 0; offset + earlyCount <= byAmount.length; offset++) {
      const early = byAmount.slice(offset, offset + earlyCount);
      const unpaid = [...byAmount.slice(0, offset), ...byAmount.slice(offset + earlyCount)];
      const reduction = unpaid.reduce((s, r) => s + r.amount, 0) - targetNotDue;
      for (let p = 0; p + notDuePartial <= unpaid.length; p++) {
        const partial = unpaid.slice(p, p + notDuePartial);
        const partialTotal = partial.reduce((s, r) => s + r.amount, 0);
        const share = partialTotal > 0 ? reduction / partialTotal : 0;
        const score = share < 0.3 ? 0.3 - share + 1 : share > 0.7 ? share - 0.7 + 1 : Math.abs(share - 0.5);
        if (!best || score < best.score) best = { early, partial, reduction, score };
      }
      if (earlyCount === 0) break;
    }
    const early = new Set(best!.early);
    const unpaid = byAmount.filter((r) => !early.has(r));
    const partial = new Set(best!.partial);
    const partialTotal = best!.partial.reduce((s, r) => s + r.amount, 0);
    const paidShareNeeded = partialTotal > 0 ? best!.reduction / partialTotal : 0.5;
    for (const r of unpaid) {
      if (partial.has(r)) {
        r.paidAmount = partialPaid(r, Math.min(0.7, Math.max(0.3, paidShareNeeded + payRng.float(-0.03, 0.03))));
        r.status = "PARTIALLY_PAID";
      } else {
        r.paidAmount = 0;
        r.status = "OPEN";
      }
    }
    const unpaidSet = new Set([...openOverdue, ...partialOverdue, ...unpaid]);
    for (const r of uah) if (!unpaidSet.has(r)) {
      r.paidAmount = r.amount;
      r.status = "PAID";
    }
  }
  // EUR: the last (not yet due) stays OPEN; one overdue June invoice keeps 6 100 EUR open; the rest are PAID.
  {
    const eur = receivables.filter((r) => r.currency === "EUR").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const last = eur[eur.length - 1];
    const partial = eur[eur.length - 4];
    for (const r of eur) {
      if (r === last) continue;
      if (r === partial) {
        r.paidAmount = r.amount - Math.max(AR_TARGETS.openEurCents - last.amount, Math.round(r.amount * 0.3));
        r.status = "PARTIALLY_PAID";
      } else {
        r.paidAmount = r.amount;
        r.status = "PAID";
      }
    }
  }
  // Payment events: PAID → 1–2 payments around the due date; PARTIAL → 1 payment.
  for (const r of receivables) {
    if (r.paidAmount === 0) continue;
    const shippedMs = new Date(r.createdAt).getTime();
    const latest = asOfMs - HOUR;
    const around = (center: number) => Math.min(latest, Math.max(shippedMs + 2 * HOUR, center));
    if (r.status === "PAID" && due(r) <= asOfMs && payRng.next() < PAID_TWO_PAYMENTS_SHARE) {
      const first = Math.round(r.amount * payRng.float(0.4, 0.7));
      const firstAt = around(shippedMs + (due(r) - shippedMs) * payRng.float(0.2, 0.6));
      const secondAt = Math.max(firstAt + HOUR, around(due(r) + payRng.float(-3, 8) * DAY));
      paymentEvents.push({ receivableId: r.id, salesOrderId: r.salesOrderId, amount: first, at: iso(firstAt) });
      paymentEvents.push({ receivableId: r.id, salesOrderId: r.salesOrderId, amount: r.amount - first, at: iso(Math.min(latest, secondAt)) });
    } else {
      // Settled around the due date; paid-early (not yet due) and partial payments land between shipment and now.
      const center =
        r.status === "PAID" && due(r) <= asOfMs
          ? due(r) + payRng.float(-5, 10) * DAY
          : shippedMs + payRng.float(0.2, 0.8) * (Math.min(latest, due(r)) - shippedMs);
      paymentEvents.push({ receivableId: r.id, salesOrderId: r.salesOrderId, amount: r.paidAmount, at: iso(around(center)) });
    }
  }
  paymentEvents.sort((a, b) => a.at.localeCompare(b.at) || (a.receivableId < b.receivableId ? -1 : 1));

  // ---- Suppliers, deliveries & payables ------------------------------------
  const supplierTerm = new Map<string, number>();
  {
    const r = rng("supplierTerms");
    for (const code of UAH_SUPPLIER_CODES) supplierTerm.set(code, r.pick([7, 10, 14, 21]));
    for (const code of EUR_SUPPLIER_CODES) supplierTerm.set(code, r.pick([30, 45]));
  }
  const supplierUpdates: SupplierUpdate[] = [...supplierTerm.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([supplierCode, paymentTermDays]) => ({ supplierCode, paymentTermDays }));
  const eurSuppliers = new Set<string>(EUR_SUPPLIER_CODES);
  const payables: Payable[] = [];
  {
    // One payable = one supplier invoice. Each currency gets exactly its
    // contracted number of invoices: start from one invoice per batch and
    // merge a supplier's chronologically adjacent deliveries (smallest
    // combined volume first, so invoice sizes stay even). Deliveries of the last SINGLE_INVOICE_RECENT_DAYS stay one
    // invoice per batch, so the open invoices are ordinary-sized.
    const lockAfter = asOfMs - SINGLE_INVOICE_RECENT_DAYS * DAY;
    const buildInvoices = (list: Batch[], count: number): Batch[][] => {
      const groups: Batch[][] = [...list]
        .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt) || (a.id < b.id ? -1 : 1))
        .map((b) => [b]);
      // At most 40 % of the invoices may be such unmerged recent singles, so
      // the older deliveries are never squeezed into a few giant invoices.
      const recentSingles = groups.filter((g) => new Date(g[0].receivedAt).getTime() >= lockAfter).length;
      const lockedFrom = groups.length - Math.min(recentSingles, Math.floor(count * 0.4));
      const locked = new Set(groups.slice(lockedFrom).map((g) => g[0].id));
      if (groups.length < count) throw new Error(`Generator invariant: ${groups.length} batches cannot form ${count} invoices`);
      const lastMs = (g: Batch[]) => new Date(g[g.length - 1].receivedAt).getTime();
      const kgOf = (g: Batch[]) => g.reduce((sum, b) => sum + b.receivedKg, 0);
      const firstMs = (g: Batch[]) => new Date(g[0].receivedAt).getTime();
      let respectLock = true;
      while (groups.length > count) {
        let bestPair: [number, number] | null = null;
        let bestGap = Infinity;
        let bestVolume = Infinity;
        const lastIndexBySupplier = new Map<string, number>();
        groups.forEach((g, i) => {
          const supplier = g[0].supplierCode;
          const prev = lastIndexBySupplier.get(supplier);
          lastIndexBySupplier.set(supplier, i);
          if (prev === undefined) return;
          if (respectLock && (locked.has(g[0].id) || locked.has(groups[prev][0].id))) return;
          // Smallest combined volume first keeps invoices even-sized (no giant invoices); gap breaks ties.
          const volume = kgOf(g) + kgOf(groups[prev]);
          const gap = firstMs(g) - lastMs(groups[prev]);
          if (volume < bestVolume || (volume === bestVolume && gap < bestGap)) {
            bestVolume = volume;
            bestGap = gap;
            bestPair = [prev, i];
          }
        });
        const pair = bestPair as [number, number] | null; // assigned inside the forEach callback
        if (!pair) {
          if (!respectLock) throw new Error("Generator invariant: cannot merge invoices further");
          respectLock = false;
          continue;
        }
        const [a, b] = pair;
        groups[a] = [...groups[a], ...groups[b]];
        groups.splice(b, 1);
      }
      return groups;
    };

    let seq = 0;
    for (const currency of ["UAH", "EUR"] as const) {
      const list = batches.filter((b) => eurSuppliers.has(b.supplierCode) === (currency === "EUR"));
      const target = PAYABLE_STATUS_TARGETS[currency];
      const invoices = buildInvoices(list, target.PAID + target.PARTIALLY_PAID + target.OPEN);
      const created: Payable[] = invoices.map((group) => {
        const supplierCode = group[0].supplierCode;
        const receivedMs = Math.max(...group.map((b) => new Date(b.receivedAt).getTime()));
        const amount = group.reduce((sum, b) => {
          const perKg = currency === "EUR" ? Math.round(productBySku.get(b.productSku)!.eurPrice! * 0.74) : b.unitCost!;
          return sum + b.receivedKg * perKg;
        }, 0);
        const k = toKyiv(new Date(receivedMs));
        seq += 1;
        return {
          id: demoId("payable", seq),
          supplierCode,
          amount,
          paidAmount: amount,
          currency,
          dueDate: iso(receivedMs + supplierTerm.get(supplierCode)! * DAY),
          status: "PAID",
          reference: `${PAYABLE_REFERENCE_PREFIX}${k.year}${String(k.month).padStart(2, "0")}${String(k.day).padStart(2, "0")}-${supplierCode}-${String(seq).padStart(3, "0")}`,
          notes: `${DEMO_MARKER} batches: ${group.map((b) => b.batchNumber).join(", ")}`,
          createdAt: iso(receivedMs),
        };
      });
      settleOpenInvoices(created, target.OPEN, target.PARTIALLY_PAID, currency === "EUR" ? AP_TARGETS.openEurCents : AP_TARGETS.openUah);
      payables.push(...created);
    }

    /**
     * Picks which invoices stay OPEN / PARTIALLY_PAID so the open balance
     * lands on `target`: among the most recent invoices, the window (by
     * amount) whose achievable range — OPEN in full plus 30–70 % of the
     * partially paid ones — contains the target and is centred closest to it.
     */
    function settleOpenInvoices(list: Payable[], openCount: number, partialCount: number, target: number) {
      const r = rng(`payables:${list[0]?.currency}`);
      const n = openCount + partialCount;
      const byRecency = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || (a.id < b.id ? -1 : 1));
      const apply = (open: Payable[], partial: Payable[]) => {
        const openTotal = open.reduce((sum, p) => sum + p.amount, 0);
        const partialTotal = partial.reduce((sum, p) => sum + p.amount, 0);
        const outstandingShare = partialTotal > 0 ? (target - openTotal) / partialTotal : 0;
        for (const p of open) {
          p.paidAmount = 0;
          p.status = "OPEN";
        }
        for (const p of partial) {
          const share = Math.min(0.7, Math.max(0.3, outstandingShare + r.float(-0.03, 0.03)));
          p.paidAmount = p.amount - Math.round(p.amount * share);
          p.status = "PARTIALLY_PAID";
        }
      };
      // Few invoices (EUR): try every combination; among those that can reach
      // the target, prefer the most recent invoices, then the best-centred mix.
      if (list.length <= 16) {
        const rank = new Map(byRecency.map((p, i) => [p, i]));
        let best: { open: Payable[]; partial: Payable[]; key: [number, number] } | null = null;
        const choose = (start: number, picked: Payable[]) => {
          if (picked.length === n) {
            for (let k = 0; k + partialCount <= n; k++) {
              if (partialCount > 1 && k > 0) break; // one partial split per combination is enough for one partial invoice
              const partial = picked.slice(k, k + partialCount);
              const open = picked.filter((p) => !partial.includes(p));
              const openTotal = open.reduce((sum, p) => sum + p.amount, 0);
              const partialTotal = partial.reduce((sum, p) => sum + p.amount, 0);
              const lo = openTotal + 0.3 * partialTotal;
              const hi = openTotal + 0.7 * partialTotal;
              if (target < lo || target > hi) continue;
              const key: [number, number] = [picked.reduce((s, p) => s + rank.get(p)!, 0), Math.abs((lo + hi) / 2 - target)];
              if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && key[1] < best.key[1])) best = { open, partial, key };
            }
            return;
          }
          for (let i = start; i < byRecency.length; i++) choose(i + 1, [...picked, byRecency[i]]);
        };
        choose(0, []);
        const found = best as { open: Payable[]; partial: Payable[] } | null;
        if (found) {
          apply(found.open, found.partial);
          return;
        }
      }
      for (const poolSize of [2 * n, 3 * n, list.length]) {
        const candidates = byRecency.slice(0, Math.min(poolSize, list.length)).sort((a, b) => a.amount - b.amount || (a.id < b.id ? -1 : 1));
        let best: { window: Payable[]; score: number } | null = null;
        for (let s = 0; s + n <= candidates.length; s++) {
          const window = candidates.slice(s, s + n);
          const partial = window.slice(n - partialCount);
          const open = window.slice(0, n - partialCount);
          const openTotal = open.reduce((sum, p) => sum + p.amount, 0);
          const partialTotal = partial.reduce((sum, p) => sum + p.amount, 0);
          const lo = openTotal + 0.3 * partialTotal;
          const hi = openTotal + 0.7 * partialTotal;
          if (target < lo || target > hi) continue;
          const score = Math.abs((lo + hi) / 2 - target);
          if (!best || score < best.score) best = { window, score };
        }
        if (!best) continue;
        apply(best.window.slice(0, n - partialCount), best.window.slice(n - partialCount));
        return;
      }
      throw new Error(
        `Generator invariant: no ${list[0]?.currency} invoice mix reaches the open payables target ${target} (amounts ${[...list].map((p) => p.amount).sort((x, y) => x - y).join(",")})`,
      );
    }
  }

  // ---- Purchase orders -----------------------------------------------------
  const purchaseOrders: PurchaseOrder[] = [];
  {
    const r = rng("purchaseOrders");
    type Plan = { status: PurchaseOrder["status"]; currency: Currency };
    const plan: Plan[] = [];
    const push = (status: PurchaseOrder["status"], currency: Currency, n: number) => {
      for (let i = 0; i < n; i++) plan.push({ status, currency });
    };
    push("CONFIRMED", "UAH", PURCHASE_ORDER_PLAN.confirmed.uah);
    push("CONFIRMED", "EUR", PURCHASE_ORDER_PLAN.confirmed.eur);
    push("DRAFT", "UAH", PURCHASE_ORDER_PLAN.draft.uah);
    push("DRAFT", "EUR", PURCHASE_ORDER_PLAN.draft.eur);
    push("CANCELLED", "UAH", PURCHASE_ORDER_PLAN.cancelled.uah);
    let confirmedSoon = 0;
    let draftGaps = 0;
    const records = plan.map((p, i) => {
      const supplierCode = p.currency === "EUR" ? r.pick(EUR_SUPPLIER_CODES) : UAH_SUPPLIER_CODES[i % UAH_SUPPLIER_CODES.length];
      const skus = productPlans.filter((pp) => pp.supplierCodes.includes(supplierCode)).map((pp) => pp.sku);
      const createdMs =
        p.status === "CANCELLED" ? asOfMs - r.float(20, 330) * DAY : p.status === "CONFIRMED" ? asOfMs - r.float(2, 20) * DAY : asOfMs - r.float(0.2, 10) * DAY;
      let expected: number | null = null;
      if (p.status === "CONFIRMED") expected = asOfMs + (confirmedSoon++ < 5 ? r.float(1, 7) : r.float(8, 30)) * DAY;
      if (p.status === "CANCELLED") expected = createdMs + r.float(7, 30) * DAY;
      const gap = p.status === "DRAFT" && draftGaps < 6 ? ["price", "date", "price", "warehouse", "date", "price"][draftGaps++] : null;
      if (p.status === "DRAFT" && gap !== "date") expected = asOfMs + r.float(10, 40) * DAY;
      const itemCount = Math.min(skus.length, r.int(1, 3));
      const itemSkus = r.shuffle(skus).slice(0, itemCount);
      const expectedYmd = expected === null ? null : toKyiv(new Date(expected));
      return {
        createdMs,
        record: {
          id: demoId("purchaseOrder", i + 1),
          orderNumber: "",
          supplierCode,
          destinationWarehouseCode: gap === "warehouse" ? null : r.pick(WAREHOUSE_CODES),
          status: p.status,
          currency: p.currency,
          orderDate: iso(createdMs),
          // Date-only field: stored as UTC midnight of the Kyiv day (as the app's date input does).
          expectedArrivalDate: expectedYmd ? iso(Date.UTC(expectedYmd.year, expectedYmd.month - 1, expectedYmd.day)) : null,
          createdAt: iso(createdMs),
          notes: DEMO_MARKER,
          items: itemSkus.map((sku, k) => {
            const pp = productBySku.get(sku)!;
            const price = p.currency === "EUR" ? Math.round((pp.eurPrice ?? 450) * 0.74) : Math.round(pp.basePrice * 0.72);
            return {
              id: demoId("purchaseOrderItem", `${i + 1}:${k}`),
              productSku: sku,
              quantityKg: roundKg(r.int(500, 5_000)),
              pricePerKg: gap === "price" && k === 0 ? null : price,
            };
          }),
        } as PurchaseOrder,
      };
    });
    // PO-YYYY-NNN by creation order; 2026 starts at 002 (PO-2026-001 already exists in production).
    const poSeq = new Map<number, number>([[2026, 1]]);
    for (const { createdMs, record } of records.sort((a, b) => a.createdMs - b.createdMs || (a.record.id < b.record.id ? -1 : 1))) {
      const year = toKyiv(new Date(createdMs)).year;
      const next = (poSeq.get(year) ?? 0) + 1;
      poSeq.set(year, next);
      record.orderNumber = `PO-${year}-${String(next).padStart(3, "0")}`;
      purchaseOrders.push(record);
    }
  }

  // ---- Customer updates -----------------------------------------------------
  const customerUpdates: CustomerUpdate[] = [];
  {
    const r = rng("customerFields");
    const lastShipped = new Map<string, number>();
    for (const o of shippedOrders) {
      const ms = new Date(o.shippedAt!).getTime();
      if (ms > (lastShipped.get(o.customerCode) ?? 0)) lastShipped.set(o.customerCode, ms);
    }
    const byWeight = [...CUSTOMERS].sort(
      (a, b) => (weightByCustomer.get(b.code) ?? 0.03) - (weightByCustomer.get(a.code) ?? 0.03) || (a.code < b.code ? -1 : 1),
    );
    const limited = new Set(byWeight.slice(0, CUSTOMERS_WITH_CREDIT_LIMIT).map((c) => c.code));
    for (const c of CUSTOMERS) {
      const group = groupByCustomer.get(c.code)!;
      const contactDaysAgo = group === "staleContact" ? r.float(25, 40) : r.float(0.5, 10);
      const next =
        group === "noSignals"
          ? null
          : group === "nextActionOverdue"
            ? asOfMs - r.float(1, 10) * DAY
            : group === "nextActionSoon"
              ? asOfMs + r.float(1, 3) * DAY
              : asOfMs + r.float(3, 14) * DAY;
      const w = weightByCustomer.get(c.code) ?? 0.03;
      customerUpdates.push({
        customerCode: c.code,
        paymentTermDays: termByCustomer.get(c.code)!,
        creditLimit: limited.has(c.code) ? roundTo100k(Math.min(3_000_000, Math.max(300_000, w * 25_000_000))) * 100 : null,
        lastPurchaseAt: lastShipped.has(c.code) ? iso(lastShipped.get(c.code)!) : null,
        lastContactAt: iso(asOfMs - contactDaysAgo * DAY),
        nextActionAt: next === null ? null : iso(next),
        attentionGroup: group,
      });
    }
  }

  // ---- Audit log --------------------------------------------------------------
  {
    const r = rng("auditActors");
    const warehouseActor = (): UserKey => (r.next() < 0.6 ? "warehouse" : "warehouse2");
    const reservationsByOrder = new Map<string, StockReservation[]>();
    for (const res of reservations) {
      const list = reservationsByOrder.get(res.salesOrderId) ?? [];
      list.push(res);
      reservationsByOrder.set(res.salesOrderId, list);
    }
    for (const d of ordered) {
      const o = orderByKey.get(d.key)!;
      const seller = o.responsible;
      const base = { orderNumber: o.orderNumber };
      log({ actor: seller, entityType: "SalesOrder", entityId: o.id, action: "CREATE", createdAt: o.createdAt, metadata: { ...base, customerCode: o.customerCode, itemCount: o.items.length, currency: o.currency } });
      if (o.status === "DRAFT") continue;
      if (o.status === "CANCELLED" && !(reservationsByOrder.get(o.id)?.length)) {
        log({ actor: seller, entityType: "SalesOrder", entityId: o.id, action: "CANCEL", createdAt: iso(d.timeline!.confirm), metadata: { ...base, fromStatus: "DRAFT", toStatus: "CANCELLED" } });
        continue;
      }
      log({ actor: seller, entityType: "SalesOrder", entityId: o.id, action: "CONFIRM", createdAt: iso(d.timeline!.confirm), metadata: { ...base, fromStatus: "DRAFT", toStatus: "CONFIRMED" } });
      const orderReservations = reservationsByOrder.get(o.id) ?? [];
      for (const res of orderReservations) {
        log({ actor: seller, entityType: "StockReservation", entityId: res.id, action: "CREATE", createdAt: res.createdAt, metadata: { salesOrderId: o.id, salesOrderItemId: res.salesOrderItemId, productSku: res.productSku, batchId: res.batchId, warehouseCode: res.warehouseCode, quantityKg: String(res.quantityKg), expiresAt: res.expiresAt } });
      }
      if (o.status === "CANCELLED") {
        const cancelAt = new Date(d.timeline!.reserve + r.float(2, 30) * HOUR).toISOString();
        log({ actor: seller, entityType: "SalesOrder", entityId: o.id, action: "CANCEL", createdAt: cancelAt, metadata: { ...base, fromStatus: "CONFIRMED", toStatus: "CANCELLED" } });
        for (const res of orderReservations) {
          log({ actor: seller, entityType: "StockReservation", entityId: res.id, action: "RELEASE", createdAt: cancelAt, metadata: { reason: "ORDER_CANCELLED", salesOrderId: o.id, salesOrderItemId: res.salesOrderItemId, quantityKg: String(res.quantityKg), fromStatus: "ACTIVE", toStatus: "RELEASED" } });
        }
        continue;
      }
      if (o.status === "CONFIRMED") continue;
      const worker = warehouseActor();
      log({ actor: worker, entityType: "SalesOrder", entityId: o.id, action: "START_PROCESSING", createdAt: iso(d.timeline!.start), metadata: { ...base, fromStatus: "CONFIRMED", toStatus: "PROCESSING", itemCount: o.items.length, reservationCount: orderReservations.length } });
      if (o.status === "PROCESSING") continue;
      log({ actor: worker, entityType: "SalesOrder", entityId: o.id, action: "MARK_READY", createdAt: iso(d.timeline!.ready), metadata: { ...base, fromStatus: "PROCESSING", toStatus: "READY", itemCount: o.items.length, reservationCount: orderReservations.length } });
      if (o.status === "READY") continue;
      for (const res of orderReservations) {
        log({ actor: worker, entityType: "StockReservation", entityId: res.id, action: "CONSUME", createdAt: o.shippedAt!, metadata: { salesOrderId: o.id, salesOrderItemId: res.salesOrderItemId, quantityKg: String(res.quantityKg), fromStatus: "ACTIVE", toStatus: "CONSUMED" } });
      }
      const rec = receivableByOrder.get(o.id)!;
      log({ actor: worker, entityType: "Receivable", entityId: rec.id, action: "CREATE", createdAt: o.shippedAt!, metadata: { salesOrderId: o.id, orderNumber: o.orderNumber, amount: rec.amount, currency: rec.currency, dueDate: rec.dueDate, paymentTermDays: termByCustomer.get(o.customerCode), status: "OPEN" } });
      log({ actor: worker, entityType: "SalesOrder", entityId: o.id, action: "SHIP", createdAt: o.shippedAt!, metadata: { ...base, fromStatus: "READY", toStatus: "SHIPPED", shippedAt: o.shippedAt, itemCount: o.items.length, reservationCount: orderReservations.length } });
    }
    const paidSoFar = new Map<string, number>();
    const receivableById = new Map(receivables.map((rec) => [rec.id, rec]));
    for (const p of paymentEvents) {
      const rec = receivableById.get(p.receivableId)!;
      const previous = paidSoFar.get(rec.id) ?? 0;
      const paid = previous + p.amount;
      paidSoFar.set(rec.id, paid);
      log({
        actor: "accounting",
        entityType: "Receivable",
        entityId: rec.id,
        action: "REGISTER_PAYMENT",
        createdAt: p.at,
        metadata: {
          salesOrderId: rec.salesOrderId,
          reference: rec.reference,
          currency: rec.currency,
          paymentAmount: p.amount,
          previousPaidAmount: previous,
          paidAmount: paid,
          outstandingAmount: rec.amount - paid,
          fromStatus: previous === 0 ? "OPEN" : "PARTIALLY_PAID",
          toStatus: paid === rec.amount ? "PAID" : "PARTIALLY_PAID",
        },
      });
    }
    for (const po of purchaseOrders) {
      log({ actor: "procurement", entityType: "PurchaseOrder", entityId: po.id, action: "CREATE", createdAt: po.createdAt, metadata: { orderNumber: po.orderNumber, supplierCode: po.supplierCode, destinationWarehouseCode: po.destinationWarehouseCode, currency: po.currency, itemCount: po.items.length } });
      if (po.status === "DRAFT") continue;
      const at = new Date(new Date(po.createdAt).getTime() + r.float(1, 30) * HOUR).toISOString();
      log({ actor: "procurement", entityType: "PurchaseOrder", entityId: po.id, action: po.status === "CONFIRMED" ? "CONFIRM" : "CANCEL", createdAt: at, metadata: { orderNumber: po.orderNumber, fromStatus: "DRAFT", toStatus: po.status } });
    }
    audit.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || (a.id < b.id ? -1 : 1));
  }

  return {
    version: DATASET_VERSION,
    seed,
    asOf: asOf.toISOString(),
    timeZone: BUSINESS_TIME_ZONE,
    customerUpdates,
    supplierUpdates,
    salesOrders,
    reservations,
    batches,
    movements,
    receivables,
    paymentEvents,
    purchaseOrders,
    payables,
    auditLogs: audit,
  };

  function roundKg(kg: number) {
    return Math.round(kg / 50) * 50;
  }
  function roundTo100k(value: number) {
    return Math.round(value / 100_000) * 100_000;
  }
}

/** Month index (0..11) of a shipped instant within the 12 Kyiv months ending at asOf; -1 outside. */
export function relativeMonthIndex(asOf: Date, ms: number): number {
  const target = kyivMonthOf(new Date(ms));
  const current = kyivMonthOf(asOf);
  const diff = (current.year - target.year) * 12 + (current.month - target.month);
  return diff >= 0 && diff < 12 ? 11 - diff : -1;
}
