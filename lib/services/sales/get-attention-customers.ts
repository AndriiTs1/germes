import { prisma } from "@/lib/db/prisma";
import {
  attentionCustomerWhere,
  getAttentionCutoffs,
  getAttentionReasons,
} from "@/lib/services/sales/attention-rules";
import type { SalesReadScope } from "@/lib/services/sales/read-scope";

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

/**
 * Customers visible in the requested read scope that need action, per V1
 * signals only: an overdue nextActionAt, or a stale lastContactAt/lastPurchaseAt
 * (rules shared with getSalesTeamSummary via attention-rules.ts).
 * The default "own" scope filters by Customer.responsibleId=currentUserId;
 * "all" is reserved for a caller that has already resolved supervisory visibility.
 */
export async function getAttentionCustomers(
  currentUserId: string,
  scope: SalesReadScope = "own",
): Promise<AttentionCustomer[]> {
  const cutoffs = getAttentionCutoffs();

  const customers = await prisma.customer.findMany({
    where: {
      responsibleId: scope === "all" ? undefined : currentUserId,
      isActive: true,
      ...attentionCustomerWhere(cutoffs),
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
    return {
      customerId: customer.id,
      customerName: customer.name,
      reasons: getAttentionReasons(customer, cutoffs),
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
