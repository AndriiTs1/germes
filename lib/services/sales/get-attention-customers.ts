import { prisma } from "@/lib/db/prisma";
import { STALE_CONTACT_DAYS, STALE_PURCHASE_DAYS } from "@/lib/services/sales/config";

export type AttentionReasonType =
  | "NEXT_ACTION_OVERDUE"
  | "STALE_CONTACT"
  | "STALE_PURCHASE";

export type AttentionReason = {
  type: AttentionReasonType;
  since: string;
};

export type AttentionCustomer = {
  customerId: string;
  customerName: string;
  reasons: AttentionReason[];
  nextActionAt: string | null;
  lastContactAt: string | null;
  lastPurchaseAt: string | null;
};

function daysAgo(days: number, from: Date): Date {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Customers assigned to currentUserId that need action, per V1 signals only:
 * an overdue nextActionAt, or a stale lastContactAt/lastPurchaseAt. Scoped
 * strictly to Customer.responsibleId — never all customers.
 */
export async function getAttentionCustomers(
  currentUserId: string,
): Promise<AttentionCustomer[]> {
  const now = new Date();
  const staleContactBefore = daysAgo(STALE_CONTACT_DAYS, now);
  const stalePurchaseBefore = daysAgo(STALE_PURCHASE_DAYS, now);

  const customers = await prisma.customer.findMany({
    where: {
      responsibleId: currentUserId,
      isActive: true,
      OR: [
        { nextActionAt: { lte: now } },
        { lastContactAt: { lt: staleContactBefore } },
        { lastPurchaseAt: { lt: stalePurchaseBefore } },
      ],
    },
    select: {
      id: true,
      name: true,
      nextActionAt: true,
      lastContactAt: true,
      lastPurchaseAt: true,
    },
  });

  const result: AttentionCustomer[] = customers.map((customer) => {
    const reasons: AttentionReason[] = [];

    if (customer.nextActionAt && customer.nextActionAt <= now) {
      reasons.push({
        type: "NEXT_ACTION_OVERDUE",
        since: customer.nextActionAt.toISOString(),
      });
    }
    if (customer.lastContactAt && customer.lastContactAt < staleContactBefore) {
      reasons.push({
        type: "STALE_CONTACT",
        since: customer.lastContactAt.toISOString(),
      });
    }
    if (customer.lastPurchaseAt && customer.lastPurchaseAt < stalePurchaseBefore) {
      reasons.push({
        type: "STALE_PURCHASE",
        since: customer.lastPurchaseAt.toISOString(),
      });
    }

    return {
      customerId: customer.id,
      customerName: customer.name,
      reasons,
      nextActionAt: customer.nextActionAt?.toISOString() ?? null,
      lastContactAt: customer.lastContactAt?.toISOString() ?? null,
      lastPurchaseAt: customer.lastPurchaseAt?.toISOString() ?? null,
    };
  });

  // Deterministic, not a scored heuristic: most reasons first, then the
  // most overdue nextActionAt, then name as a stable tiebreak.
  result.sort((a, b) => {
    if (b.reasons.length !== a.reasons.length) {
      return b.reasons.length - a.reasons.length;
    }
    const aNext = a.nextActionAt ? new Date(a.nextActionAt).getTime() : Infinity;
    const bNext = b.nextActionAt ? new Date(b.nextActionAt).getTime() : Infinity;
    if (aNext !== bNext) return aNext - bNext;
    return a.customerName.localeCompare(b.customerName);
  });

  return result;
}
