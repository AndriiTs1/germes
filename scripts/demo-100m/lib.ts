import { createHash } from "node:crypto";

/*
 * Pure helpers for the DEMO 100M generator: seeded randomness, UUIDv5,
 * Europe/Kyiv calendar arithmetic and integer money. No Prisma, no I/O.
 */

// ---------------------------------------------------------------------------
// Seeded randomness (never Math.random)
// ---------------------------------------------------------------------------

export type Rng = {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  /** Uniform float in [min, max). */
  float(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** Index chosen with probability proportional to weights[i]. */
  weightedIndex(weights: readonly number[]): number;
  shuffle<T>(items: readonly T[]): T[];
};

/** sfc32 seeded from SHA-256(seed + "|" + label): every label is an independent, reproducible stream. */
export function createRng(seed: string, label: string): Rng {
  const digest = createHash("sha256").update(`${seed}|${label}`).digest();
  let a = digest.readUInt32LE(0);
  let b = digest.readUInt32LE(4);
  let c = digest.readUInt32LE(8);
  let d = digest.readUInt32LE(12);

  const next = () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  // Discard the first outputs (standard sfc32 warm-up).
  for (let i = 0; i < 12; i++) next();

  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    float: (min, max) => min + next() * (max - min),
    pick: (items) => items[Math.floor(next() * items.length)],
    weightedIndex: (weights) => {
      const total = weights.reduce((sum, w) => sum + w, 0);
      let r = next() * total;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r < 0) return i;
      }
      return weights.length - 1;
    },
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
  return rng;
}

// ---------------------------------------------------------------------------
// UUIDv5 (RFC 9562)
// ---------------------------------------------------------------------------

const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

export function uuidV5(name: string, namespace: string): string {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(ns).update(name, "utf8").digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Namespace for every demo id: UUIDv5("germes-demo-100m", DNS namespace). */
export const DEMO_NAMESPACE = uuidV5("germes-demo-100m", DNS_NAMESPACE);

/** Deterministic id for a logical key such as "salesOrder:0001". */
export function demoId(kind: string, key: string | number): string {
  return uuidV5(`${kind}:${key}`, DEMO_NAMESPACE);
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// ---------------------------------------------------------------------------
// Europe/Kyiv calendar
// ---------------------------------------------------------------------------

export const BUSINESS_TIME_ZONE = "Europe/Kyiv";
export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

const kyivParts = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

export type KyivDateTime = { year: number; month: number; day: number; hour: number; minute: number };

export function toKyiv(date: Date): KyivDateTime {
  const parts = Object.fromEntries(kyivParts.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** The UTC instant of a Kyiv wall-clock time (DST-aware; Kyiv is UTC+2 / UTC+3). */
export function fromKyiv(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  for (const offsetHours of [3, 2]) {
    const candidate = new Date(asUtc - offsetHours * HOUR);
    const k = toKyiv(candidate);
    if (k.year === year && k.month === month && k.day === day && k.hour === hour && k.minute === minute) {
      return candidate;
    }
  }
  // Non-existent local time (spring-forward gap): fall back to the UTC+2 reading.
  return new Date(asUtc - 2 * HOUR);
}

export type YearMonth = { year: number; month: number };

export function monthKey({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function kyivMonthOf(date: Date): YearMonth {
  const { year, month } = toKyiv(date);
  return { year, month };
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function daysInMonth({ year, month }: YearMonth): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// ---------------------------------------------------------------------------
// Money / quantities — exact integers (minor units: kopecks / cents)
// ---------------------------------------------------------------------------

/** Minor units (2 decimals) → "1234.5" style Decimal string without trailing zeros. */
export function minorToDecimal(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  if (frac === 0) return `${sign}${whole}`;
  return `${sign}${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}
