import { prisma } from "@/lib/db/prisma";
import { decimalToString } from "@/lib/services/sales/decimal";

export type SalesCustomerListItem = {
  id: string;
  code: string;
  name: string;
  status: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  lastContactAt: string | null;
  lastPurchaseAt: string | null;
  nextActionAt: string | null;
  creditLimit: string | null;
  paymentTermDays: number;
};

/**
 * Customers assigned to currentUserId. Read-only CRM fields only — credit
 * limit/payment terms are included since SALES has customers.read (viewing
 * them is fine; only customers.credit_limit.update, which SALES lacks,
 * would let anyone change them). Receivable context is intentionally left
 * out here to avoid duplicating getReceivableExposure's aggregation logic;
 * the workspace summary composes both independently.
 */
export async function listSalesCustomers(
  currentUserId: string,
): Promise<SalesCustomerListItem[]> {
  const customers = await prisma.customer.findMany({
    where: { responsibleId: currentUserId, isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      contactPerson: true,
      phone: true,
      email: true,
      lastContactAt: true,
      lastPurchaseAt: true,
      nextActionAt: true,
      creditLimit: true,
      paymentTermDays: true,
    },
    orderBy: { name: "asc" },
  });

  return customers.map((customer) => ({
    id: customer.id,
    code: customer.code,
    name: customer.name,
    status: customer.status,
    contactPerson: customer.contactPerson,
    phone: customer.phone,
    email: customer.email,
    lastContactAt: customer.lastContactAt?.toISOString() ?? null,
    lastPurchaseAt: customer.lastPurchaseAt?.toISOString() ?? null,
    nextActionAt: customer.nextActionAt?.toISOString() ?? null,
    creditLimit: customer.creditLimit ? decimalToString(customer.creditLimit) : null,
    paymentTermDays: customer.paymentTermDays,
  }));
}
