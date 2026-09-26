import { SupplierStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type ProcurementOverview = {
  /** All Supplier records, regardless of isActive or status. */
  supplierCount: number;
  /** Suppliers that are not archived (isActive: true) and whose status is ACTIVE. */
  activeSupplierCount: number;
};

/**
 * Read-only procurement overview built only from data that exists today:
 * Supplier records. There is no purchase-order / goods-in-transit model in
 * the schema, so nothing about purchasing activity is derived or implied
 * here. No auth/permission logic — the page decides who may call this
 * (suppliers.read), like every other read service.
 */
export async function getProcurementOverview(): Promise<ProcurementOverview> {
  const [supplierCount, activeSupplierCount] = await Promise.all([
    prisma.supplier.count(),
    prisma.supplier.count({ where: { isActive: true, status: SupplierStatus.ACTIVE } }),
  ]);

  return { supplierCount, activeSupplierCount };
}
