import type { Prisma } from "@/lib/generated/prisma/client";

const ORDER_NUMBER_PATTERN = /^SO-(\d{4})-(\d+)$/;
const MIN_SUFFIX_WIDTH = 3;

/**
 * V1, migration-free order-number generator. No production-safe generator
 * (DB sequence, dedicated counter table) exists yet — both would require a
 * schema migration, which this stage is not allowed to make. Instead:
 *
 * 1. Fetch only orderNumber strings for the current year's "SO-<year>-"
 *    prefix (a targeted query, not the whole table).
 * 2. Parse each with a strict pattern and take the highest valid numeric
 *    suffix — malformed/nonmatching values are silently ignored rather
 *    than crashing or corrupting the sequence.
 * 3. Return maxSuffix + 1, zero-padded to at least 3 digits.
 *
 * This does NOT rely on lexicographic string ordering (which breaks once
 * suffix width varies, e.g. "9" > "10" as strings) — the suffix is always
 * compared as a parsed number.
 *
 * This function must be called with a transaction client (tx), and the
 * caller (createSalesOrder) is responsible for retrying the WHOLE
 * transaction — recomputing the candidate from scratch — if the
 * subsequent SalesOrder.create hits a unique-constraint collision on
 * orderNumber. SalesOrder.orderNumber's own @unique constraint remains
 * the actual concurrency guard; this function only picks a good first
 * guess.
 */
export async function generateOrderNumber(
  tx: Prisma.TransactionClient,
  year: number,
): Promise<string> {
  const prefix = `SO-${year}-`;

  const existing = await tx.salesOrder.findMany({
    where: { orderNumber: { startsWith: prefix } },
    select: { orderNumber: true },
  });

  let maxSuffix = 0;

  for (const { orderNumber } of existing) {
    const match = ORDER_NUMBER_PATTERN.exec(orderNumber);
    if (!match) continue;

    const suffix = Number(match[2]);
    if (Number.isSafeInteger(suffix) && suffix > maxSuffix) {
      maxSuffix = suffix;
    }
  }

  const nextSuffix = maxSuffix + 1;
  const paddedSuffix = String(nextSuffix).padStart(MIN_SUFFIX_WIDTH, "0");

  return `${prefix}${paddedSuffix}`;
}
