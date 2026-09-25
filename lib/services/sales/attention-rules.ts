import type { Prisma } from "@/lib/generated/prisma/client";
import { STALE_CONTACT_DAYS, STALE_PURCHASE_DAYS } from "@/lib/services/sales/config";
import type { AttentionReason } from "@/lib/services/sales/get-attention-customers";

/**
 * The single V1 definition of "customer needs attention", shared by
 * getAttentionCustomers (the per-customer list) and getSalesTeamSummary
 * (the per-manager count) so the two can never drift apart. Signals only:
 * an overdue nextActionAt, or a stale lastContactAt/lastPurchaseAt.
 */
export type AttentionCutoffs = {
  now: Date;
  staleContactBefore: Date;
  stalePurchaseBefore: Date;
};

function daysAgo(days: number, from: Date): Date {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}

export function getAttentionCutoffs(now: Date = new Date()): AttentionCutoffs {
  return {
    now,
    staleContactBefore: daysAgo(STALE_CONTACT_DAYS, now),
    stalePurchaseBefore: daysAgo(STALE_PURCHASE_DAYS, now),
  };
}

/** Prisma filter matching exactly the customers getAttentionReasons flags. */
export function attentionCustomerWhere(cutoffs: AttentionCutoffs): Prisma.CustomerWhereInput {
  return {
    OR: [
      { nextActionAt: { lte: cutoffs.now } },
      { lastContactAt: { lt: cutoffs.staleContactBefore } },
      { lastPurchaseAt: { lt: cutoffs.stalePurchaseBefore } },
    ],
  };
}

export function getAttentionReasons(
  customer: {
    nextActionAt: Date | null;
    lastContactAt: Date | null;
    lastPurchaseAt: Date | null;
  },
  cutoffs: AttentionCutoffs,
): AttentionReason[] {
  const reasons: AttentionReason[] = [];

  if (customer.nextActionAt && customer.nextActionAt <= cutoffs.now) {
    reasons.push({
      type: "NEXT_ACTION_OVERDUE",
      since: customer.nextActionAt.toISOString(),
    });
  }
  if (customer.lastContactAt && customer.lastContactAt < cutoffs.staleContactBefore) {
    reasons.push({
      type: "STALE_CONTACT",
      since: customer.lastContactAt.toISOString(),
    });
  }
  if (customer.lastPurchaseAt && customer.lastPurchaseAt < cutoffs.stalePurchaseBefore) {
    reasons.push({
      type: "STALE_PURCHASE",
      since: customer.lastPurchaseAt.toISOString(),
    });
  }

  return reasons;
}
