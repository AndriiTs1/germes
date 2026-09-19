import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToString } from "@/lib/services/sales/decimal";

export type SalesOrderDetailItem = {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  quantityKg: string;
  pricePerKg: string;
  lineTotal: string;
};

export type SalesOrderDetailReservation = {
  id: string;
  salesOrderItemId: string | null;
  productId: string;
  productName: string;
  batchId: string | null;
  batchNumber: string | null;
  warehouseId: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  quantityKg: string;
  status: string;
  expiresAt: string | null;
};

export type SalesOrderDetailReceivable = {
  /** Only set when exactly one receivable exists — never picked arbitrarily. */
  id: string | null;
  totalAmount: string;
  totalPaid: string;
  totalOutstanding: string;
  currency: string;
  /** Only set when exactly one receivable exists — never picked arbitrarily. */
  dueDate: string | null;
  /** Only set when exactly one receivable exists — never picked arbitrarily. */
  status: string | null;
  count: number;
};

export type SalesOrderDetail = {
  id: string;
  orderNumber: string;
  status: string;
  orderDate: string;
  requestedDate: string | null;
  shippedAt: string | null;
  currency: string;
  notes: string | null;
  customer: { id: string; name: string };
  responsible: { id: string; name: string | null } | null;
  items: SalesOrderDetailItem[];
  totalQuantityKg: string;
  totalValue: string;
  reservations: SalesOrderDetailReservation[];
  receivable: SalesOrderDetailReceivable | null;
};

type RawReceivable = {
  id: string;
  amount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  currency: string;
  dueDate: Date | null;
  status: string;
};

/**
 * Aggregates all receivables linked to this order. Never combines amounts
 * across currencies: if any linked receivable's currency differs from the
 * order's own currency, this returns null entirely (V1 fails safe rather
 * than showing a misleading partial total). dueDate/status are only
 * exposed when exactly one receivable exists — with more than one, which
 * one "is" the order's due date/status is genuinely ambiguous, so neither
 * is arbitrarily picked.
 */
function buildReceivableAggregate(
  receivables: RawReceivable[],
  orderCurrency: string,
): SalesOrderDetailReceivable | null {
  if (receivables.length === 0) return null;

  const allMatchOrderCurrency = receivables.every((r) => r.currency === orderCurrency);
  if (!allMatchOrderCurrency) return null;

  let totalAmount = new Prisma.Decimal(0);
  let totalPaid = new Prisma.Decimal(0);

  for (const receivable of receivables) {
    totalAmount = totalAmount.plus(receivable.amount);
    totalPaid = totalPaid.plus(receivable.paidAmount);
  }

  const isSingle = receivables.length === 1;

  return {
    id: isSingle ? receivables[0].id : null,
    totalAmount: decimalToString(totalAmount),
    totalPaid: decimalToString(totalPaid),
    totalOutstanding: decimalToString(totalAmount.minus(totalPaid)),
    currency: orderCurrency,
    dueDate: isSingle ? (receivables[0].dueDate?.toISOString() ?? null) : null,
    status: isSingle ? receivables[0].status : null,
    count: receivables.length,
  };
}

/**
 * Full detail for exactly one order owned by currentUserId. Scoped
 * directly in the query (id + responsibleId together, via findFirst) so
 * "doesn't exist" and "belongs to someone else" are indistinguishable —
 * both resolve to null from this single query, never a separate
 * existence check that could leak which case occurred.
 *
 * No auth/Supabase/permission/role logic here — the caller (the page) is
 * responsible for requirePermission() and for calling notFound() when
 * this returns null.
 *
 * One query (Prisma resolves the nested selects as a single query plan —
 * no N+1). Never fetches Batch internals or StockMovement, and never
 * infers warehouse/shipment information — none of that is modeled as a
 * direct fact reachable from SalesOrder today.
 */
export async function getSalesOrderDetail(
  currentUserId: string,
  orderId: string,
): Promise<SalesOrderDetail | null> {
  const order = await prisma.salesOrder.findFirst({
    where: { id: orderId, responsibleId: currentUserId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      orderDate: true,
      requestedDate: true,
      shippedAt: true,
      currency: true,
      notes: true,
      customer: { select: { id: true, name: true } },
      responsible: { select: { id: true, name: true } },
      items: {
        select: {
          id: true,
          quantityKg: true,
          pricePerKg: true,
          product: { select: { id: true, sku: true, name: true } },
        },
      },
      reservations: {
        select: {
          id: true,
          salesOrderItemId: true,
          quantityKg: true,
          status: true,
          expiresAt: true,
          product: { select: { id: true, name: true } },
          batch: { select: { id: true, batchNumber: true } },
          warehouse: { select: { id: true, code: true, name: true } },
        },
      },
      receivables: {
        select: {
          id: true,
          amount: true,
          paidAmount: true,
          currency: true,
          dueDate: true,
          status: true,
        },
      },
    },
  });

  if (!order) return null;

  let totalValue = new Prisma.Decimal(0);
  let totalQuantityKg = new Prisma.Decimal(0);

  const items: SalesOrderDetailItem[] = order.items.map((item) => {
    const lineTotal = item.quantityKg.times(item.pricePerKg);
    totalValue = totalValue.plus(lineTotal);
    totalQuantityKg = totalQuantityKg.plus(item.quantityKg);

    return {
      id: item.id,
      productId: item.product.id,
      sku: item.product.sku,
      productName: item.product.name,
      quantityKg: decimalToString(item.quantityKg),
      pricePerKg: decimalToString(item.pricePerKg),
      lineTotal: decimalToString(lineTotal),
    };
  });

  const reservations: SalesOrderDetailReservation[] = order.reservations.map(
    (reservation) => ({
      id: reservation.id,
      salesOrderItemId: reservation.salesOrderItemId,
      productId: reservation.product.id,
      productName: reservation.product.name,
      batchId: reservation.batch?.id ?? null,
      batchNumber: reservation.batch?.batchNumber ?? null,
      warehouseId: reservation.warehouse?.id ?? null,
      warehouseCode: reservation.warehouse?.code ?? null,
      warehouseName: reservation.warehouse?.name ?? null,
      quantityKg: decimalToString(reservation.quantityKg),
      status: reservation.status,
      expiresAt: reservation.expiresAt?.toISOString() ?? null,
    }),
  );

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    orderDate: order.orderDate.toISOString(),
    requestedDate: order.requestedDate?.toISOString() ?? null,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    currency: order.currency,
    notes: order.notes,
    customer: order.customer,
    responsible: order.responsible,
    items,
    totalQuantityKg: decimalToString(totalQuantityKg),
    totalValue: decimalToString(totalValue),
    reservations,
    receivable: buildReceivableAggregate(order.receivables, order.currency),
  };
}
