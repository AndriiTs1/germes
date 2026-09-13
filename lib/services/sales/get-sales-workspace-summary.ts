import {
  getAttentionCustomers,
  type AttentionCustomer,
} from "@/lib/services/sales/get-attention-customers";
import {
  listSalesOrders,
  type SalesOrderListItem,
} from "@/lib/services/sales/list-sales-orders";
import {
  getReceivableExposure,
  type ReceivableExposureByCurrency,
} from "@/lib/services/sales/get-receivable-exposure";
import {
  getStockAvailability,
  type ProductStockAvailability,
} from "@/lib/services/sales/get-stock-availability";
import {
  getReservationsRequiringAttention,
  type ReservationAttentionItem,
} from "@/lib/services/sales/get-reservations-requiring-attention";

const RECENT_ORDERS_LIMIT = 5;

export type SalesWorkspaceSummary = {
  attention: AttentionCustomer[];
  orders: SalesOrderListItem[];
  receivables: ReceivableExposureByCurrency[];
  stock: ProductStockAvailability[];
  reservations: ReservationAttentionItem[];
};

/**
 * Compact, UI-ready aggregate for the future /sales landing page. Runs the
 * five independent queries in parallel — no query depends on another's
 * result, so a handful of parallel round-trips is appropriate here rather
 * than one giant join. "orders" is deliberately the current/non-terminal
 * slice (limit 5) — a full history belongs to listSalesOrders's own
 * pagination, not the summary.
 */
export async function getSalesWorkspaceSummary(
  currentUserId: string,
): Promise<SalesWorkspaceSummary> {
  const [attention, ordersResult, receivables, stock, reservations] = await Promise.all([
    getAttentionCustomers(currentUserId),
    listSalesOrders(currentUserId, { onlyActive: true, limit: RECENT_ORDERS_LIMIT }),
    getReceivableExposure(currentUserId),
    getStockAvailability(),
    getReservationsRequiringAttention(currentUserId),
  ]);

  return {
    attention,
    orders: ordersResult.orders,
    receivables,
    stock,
    reservations,
  };
}
