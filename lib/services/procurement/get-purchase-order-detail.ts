import { Prisma, type PurchaseOrderStatus, type SupplierStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToString } from "@/lib/services/sales/decimal";

export type PurchaseOrderDetailItem = {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  unit: string;
  quantityKg: string;
  /** null while the supplier price is not yet known (allowed in a DRAFT). */
  pricePerKg: string | null;
  /** quantityKg × pricePerKg; null whenever pricePerKg is null — never a zero stand-in. */
  lineAmount: string | null;
};

export type PurchaseOrderDetail = {
  id: string;
  orderNumber: string;
  status: PurchaseOrderStatus;
  currency: string;
  orderDate: string | null;
  expectedArrivalDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  supplier: {
    id: string;
    code: string;
    name: string;
    status: SupplierStatus;
    country: string | null;
    paymentTermDays: number;
  };
  destinationWarehouse: { id: string; code: string; name: string } | null;
  createdBy: { id: string; name: string | null };
  items: PurchaseOrderDetailItem[];
  totalQuantityKg: string;
  itemCount: number;
  pricedItemCount: number;
  missingPriceCount: number;
  /** Only set when EVERY item has a price; a partial sum is never presented as the order total. */
  totalAmount: string | null;
};

/**
 * Full detail for one PurchaseOrder, or null when it doesn't exist.
 *
 * No auth/permission logic and no createdById scope: every holder of
 * procurement.orders.read may read every PurchaseOrder, and the caller
 * (the page) is responsible for requirePermission() and for calling
 * notFound() on null.
 *
 * One query with explicit selects. Read-only — never writes anything.
 * All money/kg arithmetic happens here in Prisma.Decimal; values leave as
 * decimal strings and dates as ISO strings, so the result is plain,
 * serializable data.
 *
 * PurchaseOrderItem has no line-position field, so items are ordered by
 * product name, then item id, for a stable order.
 */
export async function getPurchaseOrderDetail(
  purchaseOrderId: string,
): Promise<PurchaseOrderDetail | null> {
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      currency: true,
      orderDate: true,
      expectedArrivalDate: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      supplier: {
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          country: true,
          paymentTermDays: true,
        },
      },
      destinationWarehouse: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      items: {
        select: {
          id: true,
          quantityKg: true,
          pricePerKg: true,
          product: { select: { id: true, sku: true, name: true, unit: true } },
        },
        orderBy: [{ product: { name: "asc" } }, { id: "asc" }],
      },
    },
  });

  if (!order) return null;

  let totalQuantityKg = new Prisma.Decimal(0);
  let pricedTotal = new Prisma.Decimal(0);
  let pricedItemCount = 0;

  const items: PurchaseOrderDetailItem[] = order.items.map((item) => {
    totalQuantityKg = totalQuantityKg.plus(item.quantityKg);

    let lineAmount: Prisma.Decimal | null = null;
    if (item.pricePerKg !== null) {
      lineAmount = item.quantityKg.times(item.pricePerKg);
      pricedTotal = pricedTotal.plus(lineAmount);
      pricedItemCount += 1;
    }

    return {
      id: item.id,
      productId: item.product.id,
      sku: item.product.sku,
      productName: item.product.name,
      unit: item.product.unit,
      quantityKg: decimalToString(item.quantityKg),
      pricePerKg: item.pricePerKg === null ? null : decimalToString(item.pricePerKg),
      lineAmount: lineAmount === null ? null : decimalToString(lineAmount),
    };
  });

  const itemCount = items.length;
  const missingPriceCount = itemCount - pricedItemCount;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    currency: order.currency,
    orderDate: order.orderDate?.toISOString() ?? null,
    expectedArrivalDate: order.expectedArrivalDate?.toISOString() ?? null,
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    supplier: order.supplier,
    destinationWarehouse: order.destinationWarehouse,
    createdBy: order.createdBy,
    items,
    totalQuantityKg: decimalToString(totalQuantityKg),
    itemCount,
    pricedItemCount,
    missingPriceCount,
    totalAmount: missingPriceCount === 0 ? decimalToString(pricedTotal) : null,
  };
}
