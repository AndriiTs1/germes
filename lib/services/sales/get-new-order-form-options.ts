import { CustomerStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type NewOrderFormCustomer = {
  id: string;
  code: string;
  name: string;
  status: string;
};

export type NewOrderFormProduct = {
  id: string;
  sku: string;
  name: string;
  unit: string;
};

export type NewOrderFormOptions = {
  customers: NewOrderFormCustomer[];
  products: NewOrderFormProduct[];
};

/** Only statuses eligible to receive a new order — see createSalesOrder for the enforced (server-side) version of this same rule. */
const ELIGIBLE_CUSTOMER_STATUSES: CustomerStatus[] = [
  CustomerStatus.ACTIVE,
  CustomerStatus.POTENTIAL,
];

/**
 * Lightweight lookup for the New Order form's two selectors. Deliberately
 * NOT listSalesCustomers, which additionally computes activeOrdersCount
 * and currency-grouped receivables via extra queries a dropdown has no
 * use for, and which paginates (would silently truncate a salesperson
 * with many customers). This is two small, flat, unpaginated queries.
 *
 * Customers are scoped to currentUserId + isActive + the two order-
 * eligible statuses (ACTIVE/POTENTIAL) — INACTIVE/BLOCKED customers never
 * even appear as an option, so the browser can't offer them regardless of
 * what createSalesOrder additionally enforces server-side.
 *
 * Products are company-wide (not scoped to any salesperson), matching
 * getStockAvailability's scope — isActive is the only filter.
 */
export async function getNewOrderFormOptions(
  currentUserId: string,
): Promise<NewOrderFormOptions> {
  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      where: {
        responsibleId: currentUserId,
        isActive: true,
        status: { in: ELIGIBLE_CUSTOMER_STATUSES },
      },
      select: { id: true, code: true, name: true, status: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, sku: true, name: true, unit: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { customers, products };
}
