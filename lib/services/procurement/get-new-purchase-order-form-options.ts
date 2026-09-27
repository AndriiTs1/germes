import { SupplierStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type NewPurchaseOrderFormSupplier = {
  id: string;
  code: string;
  name: string;
};

export type NewPurchaseOrderFormWarehouse = {
  id: string;
  code: string;
  name: string;
};

export type NewPurchaseOrderFormProduct = {
  id: string;
  sku: string;
  name: string;
};

export type NewPurchaseOrderFormOptions = {
  suppliers: NewPurchaseOrderFormSupplier[];
  warehouses: NewPurchaseOrderFormWarehouse[];
  products: NewPurchaseOrderFormProduct[];
};

/**
 * Same rule createPurchaseOrder enforces server-side for a DRAFT
 * (DRAFT_ELIGIBLE_SUPPLIER_STATUSES there) — duplicated here so the form
 * never offers a supplier the service would reject.
 */
const DRAFT_ELIGIBLE_SUPPLIER_STATUSES: SupplierStatus[] = [
  SupplierStatus.ACTIVE,
  SupplierStatus.POTENTIAL,
  SupplierStatus.IN_PROGRESS,
];

/**
 * Read-only lookup for the New Purchase Order form's selectors — three
 * small, flat, unpaginated queries (same approach as getNewOrderFormOptions
 * for Sales). No stock, batches, prices or SupplierProduct filtering.
 */
export async function getNewPurchaseOrderFormOptions(): Promise<NewPurchaseOrderFormOptions> {
  const [suppliers, warehouses, products] = await Promise.all([
    prisma.supplier.findMany({
      where: { isActive: true, status: { in: DRAFT_ELIGIBLE_SUPPLIER_STATUSES } },
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, sku: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { suppliers, warehouses, products };
}
