import type { Prisma } from "@/lib/generated/prisma/client";

const PURCHASE_ORDER_NUMBER_PATTERN = /^PO-(\d{4})-(\d+)$/;
const MIN_SUFFIX_WIDTH = 3;

/**
 * PurchaseOrder counterpart of lib/services/sales/generate-order-number.ts,
 * deliberately kept separate rather than generalized. Same algorithm:
 *
 * 1. Fetch only orderNumber strings with this year's "PO-<year>-" prefix.
 * 2. Parse each with a strict pattern (and the same year) and take the
 *    highest valid numeric suffix — malformed values are ignored.
 * 3. Return maxSuffix + 1, zero-padded to at least 3 digits.
 *
 * Suffixes are compared as numbers, never lexicographically.
 *
 * Must be called with a transaction client (tx). The caller
 * (createPurchaseOrder) retries the WHOLE transaction if the subsequent
 * create hits the orderNumber unique constraint — that constraint is the
 * actual concurrency guard; this function only picks a good first guess.
 */
export async function generatePurchaseOrderNumber(
  tx: Prisma.TransactionClient,
  year: number,
): Promise<string> {
  const prefix = `PO-${year}-`;

  const existing = await tx.purchaseOrder.findMany({
    where: { orderNumber: { startsWith: prefix } },
    select: { orderNumber: true },
  });

  let maxSuffix = 0;

  for (const { orderNumber } of existing) {
    const match = PURCHASE_ORDER_NUMBER_PATTERN.exec(orderNumber);
    if (!match || match[1] !== String(year)) continue;

    const suffix = Number(match[2]);
    if (Number.isSafeInteger(suffix) && suffix > maxSuffix) {
      maxSuffix = suffix;
    }
  }

  const nextSuffix = maxSuffix + 1;
  const paddedSuffix = String(nextSuffix).padStart(MIN_SUFFIX_WIDTH, "0");

  return `${prefix}${paddedSuffix}`;
}
