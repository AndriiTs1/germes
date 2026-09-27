import { Prisma, PurchaseOrderStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToString } from "@/lib/services/sales/decimal";

/** Rows shown per overview section; the full registry is /procurement/orders. */
export const PROCUREMENT_OVERVIEW_ROW_LIMIT = 5;

/** "Upcoming planned arrivals" window: today plus the next 7 calendar days. */
export const PLANNED_ARRIVAL_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ProcurementAttentionReason = "MISSING_PRICE" | "MISSING_WAREHOUSE" | "MISSING_EXPECTED_ARRIVAL";

export type ProcurementAttentionItem = {
  id: string;
  orderNumber: string;
  supplierName: string;
  reasons: ProcurementAttentionReason[];
};

export type ProcurementPlannedArrival = {
  id: string;
  orderNumber: string;
  supplierName: string;
  expectedArrivalDate: string;
  totalQuantityKg: string;
  destinationWarehouseName: string | null;
};

export type ProcurementWorkspaceOverview = {
  purchaseOrderCount: number;
  draftCount: number;
  confirmedCount: number;
  /** Sum of item quantityKg over CONFIRMED orders only — "ordered", never "in transit" or stock. */
  orderedQuantityKg: string;
  attention: { items: ProcurementAttentionItem[]; totalCount: number };
  /** Totals over ALL CONFIRMED orders planned in the window — not just the rows below. */
  plannedArrivalCount: number;
  plannedArrivalQuantityKg: string;
  /** Up to PROCUREMENT_OVERVIEW_ROW_LIMIT nearest rows of the same set. */
  plannedArrivals: ProcurementPlannedArrival[];
};

/**
 * Report-only conditions the PurchaseOrder data itself proves:
 * - a DRAFT with at least one item without a price;
 * - a DRAFT without a destination warehouse;
 * - a CONFIRMED order without a planned arrival date.
 * A missing date on a DRAFT is not a problem (it's optional while drafting).
 */
export const ATTENTION_WHERE: Prisma.PurchaseOrderWhereInput = {
  OR: [
    { status: PurchaseOrderStatus.DRAFT, items: { some: { pricePerKg: null } } },
    { status: PurchaseOrderStatus.DRAFT, destinationWarehouseId: null },
    { status: PurchaseOrderStatus.CONFIRMED, expectedArrivalDate: null },
  ],
};

/**
 * [today, today + 8 days) on the UTC calendar — the same convention used to
 * store date-only fields (expectedArrivalDate is written as UTC midnight of
 * the chosen day, see createPurchaseOrder).
 */
export function getPlannedArrivalWindow(now: Date): { from: Date; to: Date } {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const to = new Date(from.getTime() + (PLANNED_ARRIVAL_WINDOW_DAYS + 1) * DAY_MS);
  return { from, to };
}

export function getAttentionReasons(order: {
  status: PurchaseOrderStatus;
  destinationWarehouseId: string | null;
  expectedArrivalDate: Date | null;
  hasItemWithoutPrice: boolean;
}): ProcurementAttentionReason[] {
  const reasons: ProcurementAttentionReason[] = [];
  if (order.status === PurchaseOrderStatus.DRAFT) {
    if (order.hasItemWithoutPrice) reasons.push("MISSING_PRICE");
    if (order.destinationWarehouseId === null) reasons.push("MISSING_WAREHOUSE");
  }
  if (order.status === PurchaseOrderStatus.CONFIRMED && order.expectedArrivalDate === null) {
    reasons.push("MISSING_EXPECTED_ARRIVAL");
  }
  return reasons;
}

/**
 * Read-only data for the /procurement control overview, built only from
 * PurchaseOrder facts (plus the supplier/warehouse names describing them).
 * No stock, sales demand, shipments, receipts or payables are read or
 * implied: CONFIRMED means "ordered", and a past planned date is never
 * reported as overdue because no receipt data exists to prove it.
 * Not a separate permission scope — the page enforces
 * procurement.overview.read. Separate from getProcurementOverview, which
 * serves supplier counts for /procurement/suppliers.
 */
export async function getProcurementWorkspaceOverview(now: Date = new Date()): Promise<ProcurementWorkspaceOverview> {
  const window = getPlannedArrivalWindow(now);
  const plannedWhere: Prisma.PurchaseOrderWhereInput = {
    status: PurchaseOrderStatus.CONFIRMED,
    expectedArrivalDate: { gte: window.from, lt: window.to },
  };

  const [
    purchaseOrderCount,
    draftCount,
    confirmedCount,
    ordered,
    attentionRows,
    attentionCount,
    plannedArrivalCount,
    plannedQuantity,
    arrivalRows,
  ] = await Promise.all([
      prisma.purchaseOrder.count(),
      prisma.purchaseOrder.count({ where: { status: PurchaseOrderStatus.DRAFT } }),
      prisma.purchaseOrder.count({ where: { status: PurchaseOrderStatus.CONFIRMED } }),
      prisma.purchaseOrderItem.aggregate({
        where: { purchaseOrder: { status: PurchaseOrderStatus.CONFIRMED } },
        _sum: { quantityKg: true },
      }),
      prisma.purchaseOrder.findMany({
        where: ATTENTION_WHERE,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          destinationWarehouseId: true,
          expectedArrivalDate: true,
          supplier: { select: { name: true } },
          // Only needs to know whether ANY item lacks a price — one row suffices.
          items: { where: { pricePerKg: null }, select: { id: true }, take: 1 },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: PROCUREMENT_OVERVIEW_ROW_LIMIT,
      }),
      prisma.purchaseOrder.count({ where: ATTENTION_WHERE }),
      prisma.purchaseOrder.count({ where: plannedWhere }),
      prisma.purchaseOrderItem.aggregate({
        where: { purchaseOrder: plannedWhere },
        _sum: { quantityKg: true },
      }),
      prisma.purchaseOrder.findMany({
        where: plannedWhere,
        select: {
          id: true,
          orderNumber: true,
          expectedArrivalDate: true,
          supplier: { select: { name: true } },
          destinationWarehouse: { select: { name: true } },
          items: { select: { quantityKg: true } },
        },
        orderBy: [{ expectedArrivalDate: "asc" }, { orderNumber: "asc" }],
        take: PROCUREMENT_OVERVIEW_ROW_LIMIT,
      }),
    ]);

  return {
    purchaseOrderCount,
    draftCount,
    confirmedCount,
    orderedQuantityKg: decimalToString(ordered._sum.quantityKg ?? new Prisma.Decimal(0)),
    attention: {
      totalCount: attentionCount,
      items: attentionRows.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        supplierName: order.supplier.name,
        reasons: getAttentionReasons({
          status: order.status,
          destinationWarehouseId: order.destinationWarehouseId,
          expectedArrivalDate: order.expectedArrivalDate,
          hasItemWithoutPrice: order.items.length > 0,
        }),
      })),
    },
    plannedArrivalCount,
    plannedArrivalQuantityKg: decimalToString(plannedQuantity._sum.quantityKg ?? new Prisma.Decimal(0)),
    plannedArrivals: arrivalRows.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      supplierName: order.supplier.name,
      // Non-null by the where clause above.
      expectedArrivalDate: (order.expectedArrivalDate as Date).toISOString(),
      totalQuantityKg: decimalToString(
        order.items.reduce((sum, item) => sum.plus(item.quantityKg), new Prisma.Decimal(0)),
      ),
      destinationWarehouseName: order.destinationWarehouse?.name ?? null,
    })),
  };
}
