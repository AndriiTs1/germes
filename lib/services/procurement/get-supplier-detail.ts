import type { SupplierStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type SupplierDetail = {
  id: string;
  code: string;
  name: string;
  status: SupplierStatus;
  legalName: string | null;
  taxId: string | null;
  country: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  responsible: { id: string; name: string | null; email: string } | null;
};

/** Blank/whitespace-only text is "not specified" — the page renders one neutral value for both. */
function textOrNull(value: string | null): string | null {
  return value !== null && value.trim() !== "" ? value : null;
}

/**
 * Read-only detail for one Supplier, or null when it doesn't exist.
 *
 * No auth/permission logic: the caller (the page) is responsible for
 * requirePermission() and for calling notFound() on null. No isActive or
 * status filter — the directory lists every Supplier record, so every
 * listed row must open.
 *
 * Deliberately NOT selected: paymentTermDays (its meaning — prepayment vs.
 * "not set" — is undefined, so it must not be shown as a commercial term),
 * rating, lastContactAt/nextActionAt, isActive and timestamps. Purchase
 * order history, SupplierProduct, payables and documents are separate steps.
 */
export async function getSupplierDetail(supplierId: string): Promise<SupplierDetail | null> {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      legalName: true,
      taxId: true,
      country: true,
      contactPerson: true,
      phone: true,
      email: true,
      address: true,
      notes: true,
      responsible: { select: { id: true, name: true, email: true } },
    },
  });

  if (!supplier) {
    return null;
  }

  return {
    id: supplier.id,
    code: supplier.code,
    name: supplier.name,
    status: supplier.status,
    legalName: textOrNull(supplier.legalName),
    taxId: textOrNull(supplier.taxId),
    country: textOrNull(supplier.country),
    contactPerson: textOrNull(supplier.contactPerson),
    phone: textOrNull(supplier.phone),
    email: textOrNull(supplier.email),
    address: textOrNull(supplier.address),
    notes: textOrNull(supplier.notes),
    responsible: supplier.responsible,
  };
}
