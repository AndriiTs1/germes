import { Prisma, PurchaseOrderStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToString } from "@/lib/services/sales/decimal";

export const PURCHASE_ORDER_PAGE_SIZE = 20;

/** Only open orders can still be completed; CLOSED/CANCELLED never carry attention flags. */
const OPEN_PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = [
  PurchaseOrderStatus.DRAFT,
  PurchaseOrderStatus.CONFIRMED,
];

export type PurchaseOrderListItem = {
  id: string;
  orderNumber: string;
  status: PurchaseOrderStatus;
  currency: string;
  supplier: { id: string; code: string; name: string };
  destinationWarehouse: { id: string; code: string; name: string } | null;
  itemCount: number;
  totalQuantityKg: string;
  pricedItemCount: number;
  missingPriceCount: number;
  /** Only set when EVERY item has a price; a partial sum is never presented as the order total. */
  totalAmount: string | null;
  expectedArrivalDate: string | null;
  createdAt: string;
  needsAttention: {
    missingPrice: boolean;
    missingWarehouse: boolean;
    missingExpectedArrival: boolean;
  };
};

export type ListPurchaseOrdersOptions = {
  /** Case-insensitive match on order number, supplier name or supplier code. */
  q?: string;
  status?: PurchaseOrderStatus;
  /** 1-indexed. */
  page?: number;
};

export type ListPurchaseOrdersResult = {
  items: PurchaseOrderListItem[];
  /** Orders matching the current search/status filter. */
  totalCount: number;
  /** All PurchaseOrders, unfiltered — distinguishes "none yet" from "no matches". */
  allCount: number;
  page: number;
  /** At least 1. */
  pageCount: number;
};

/**
 * Read-only PurchaseOrder list, newest first. No permission or createdById
 * scope here: every holder of procurement.orders.read sees every order,
 * and the caller (the page) enforces that permission.
 *
 * One paginated findMany plus two counts. Amounts are derived from the
 * items with Prisma.Decimal (never JS numbers) and leave as strings;
 * totalAmount stays null while any item has no price.
 */
export async function listPurchaseOrders(
  options: ListPurchaseOrdersOptions = {},
): Promise<ListPurchaseOrdersResult> {
  const search = options.q?.trim();
  const page = options.page && options.page > 0 ? Math.floor(options.page) : 1;

  const where: Prisma.PurchaseOrderWhereInput = {
    status: options.status,
    OR: search
      ? [
          { orderNumber: { contains: search, mode: "insensitive" } },
          { supplier: { name: { contains: search, mode: "insensitive" } } },
          { supplier: { code: { contains: search, mode: "insensitive" } } },
        ]
      : undefined,
  };

  const [orders, totalCount, allCount] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        currency: true,
        expectedArrivalDate: true,
        createdAt: true,
        supplier: { select: { id: true, code: true, name: true } },
        destinationWarehouse: { select: { id: true, code: true, name: true } },
        items: { select: { quantityKg: true, pricePerKg: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PURCHASE_ORDER_PAGE_SIZE,
      take: PURCHASE_ORDER_PAGE_SIZE,
    }),
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.count(),
  ]);

  const items: PurchaseOrderListItem[] = orders.map((order) => {
    let totalQuantityKg = new Prisma.Decimal(0);
    let pricedTotal = new Prisma.Decimal(0);
    let pricedItemCount = 0;

    for (const item of order.items) {
      totalQuantityKg = totalQuantityKg.plus(item.quantityKg);
      if (item.pricePerKg !== null) {
        pricedTotal = pricedTotal.plus(item.quantityKg.times(item.pricePerKg));
        pricedItemCount += 1;
      }
    }

    const itemCount = order.items.length;
    const missingPriceCount = itemCount - pricedItemCount;
    const isOpen = OPEN_PURCHASE_ORDER_STATUSES.includes(order.status);

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      supplier: order.supplier,
      destinationWarehouse: order.destinationWarehouse,
      itemCount,
      totalQuantityKg: decimalToString(totalQuantityKg),
      pricedItemCount,
      missingPriceCount,
      totalAmount: missingPriceCount === 0 ? decimalToString(pricedTotal) : null,
      expectedArrivalDate: order.expectedArrivalDate?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
      needsAttention: {
        missingPrice: isOpen && missingPriceCount > 0,
        missingWarehouse: isOpen && order.destinationWarehouse === null,
        missingExpectedArrival: isOpen && order.expectedArrivalDate === null,
      },
    };
  });

  return {
    items,
    totalCount,
    allCount,
    page,
    pageCount: Math.max(1, Math.ceil(totalCount / PURCHASE_ORDER_PAGE_SIZE)),
  };
}
