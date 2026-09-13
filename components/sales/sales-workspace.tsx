import { CircleDollarSign, ClipboardList, PackageSearch, UserRoundCheck } from "lucide-react";

import { Prisma } from "@/lib/generated/prisma/client";
import { getAttentionCustomers } from "@/lib/services/sales/get-attention-customers";
import { getReceivableExposure } from "@/lib/services/sales/get-receivable-exposure";
import { getReservationsRequiringAttention } from "@/lib/services/sales/get-reservations-requiring-attention";
import { getStockAvailability } from "@/lib/services/sales/get-stock-availability";
import { listSalesOrders } from "@/lib/services/sales/list-sales-orders";
import { ActiveOrdersCard } from "@/components/sales/active-orders-card";
import { AvailableStockCard } from "@/components/sales/available-stock-card";
import { NeedsAttentionCard } from "@/components/sales/needs-attention-card";
import { ReceivablesCard } from "@/components/sales/receivables-card";
import { ReservationsCard } from "@/components/sales/reservations-card";
import { formatKg } from "@/components/sales/format";
import { SalesKpiSummary, type SalesKpiCardProps } from "@/components/sales/sales-kpi-row";

const RECENT_ORDERS_LIMIT = 5;

type SalesWorkspaceProps = {
  userId: string;
  permissionCodes: string[];
};

/**
 * Permission-gated data orchestration for /sales. Per-widget permission
 * checks happen here, BEFORE each service call — never "fetch everything
 * then hide cards", since that would fetch data the user isn't entitled
 * to see. Each service stays permission-agnostic, as designed in Stage 8C;
 * all authorization decisions live in this Server Component instead.
 */
export async function SalesWorkspace({ userId, permissionCodes }: SalesWorkspaceProps) {
  const canReadCustomers = permissionCodes.includes("customers.read");
  const canReadOrders = permissionCodes.includes("sales.orders.read");
  const canReadStock = permissionCodes.includes("inventory.stock.read");
  const canReadReservations = permissionCodes.includes("sales.reservations.read");
  const canReadReceivables = permissionCodes.includes("finance.receivables.read");

  const [attentionCustomers, ordersResult, stock, reservations, receivables] = await Promise.all([
    canReadCustomers ? getAttentionCustomers(userId) : Promise.resolve(null),
    canReadOrders
      ? listSalesOrders(userId, { onlyActive: true, limit: RECENT_ORDERS_LIMIT })
      : Promise.resolve(null),
    canReadStock ? getStockAvailability() : Promise.resolve(null),
    canReadReservations ? getReservationsRequiringAttention(userId) : Promise.resolve(null),
    canReadReceivables ? getReceivableExposure(userId) : Promise.resolve(null),
  ]);

  const kpis: SalesKpiCardProps[] = [];

  if (attentionCustomers) {
    kpis.push({
      label: "Needs Attention",
      value: String(attentionCustomers.length),
      icon: UserRoundCheck,
      accent: "rose",
    });
  }

  if (ordersResult) {
    kpis.push({
      label: "Active Orders",
      value: String(ordersResult.totalCount),
      icon: ClipboardList,
      accent: "blue",
    });
  }

  if (receivables) {
    const withOverdue = receivables.filter((bucket) => bucket.overdueOutstanding !== "0");

    let value: string;
    let unit: string | undefined;

    if (withOverdue.length === 0) {
      value = "0";
    } else if (withOverdue.length === 1) {
      value = formatKg(withOverdue[0].overdueOutstanding);
      unit = withOverdue[0].currency;
    } else {
      // Never combine currencies into one fake total — show a compact,
      // currency-safe count instead. Individual values remain available
      // in the Receivables card itself.
      value = String(withOverdue.length);
      unit = "currencies";
    }

    kpis.push({ label: "Overdue AR", value, unit, icon: CircleDollarSign, accent: "amber" });
  }

  if (stock) {
    const totalReserved = stock.reduce(
      (sum, product) => sum.plus(product.activeReservedKg),
      new Prisma.Decimal(0),
    );
    const totalInconsistent = stock.reduce(
      (sum, product) => sum.plus(product.inconsistentReservedKg),
      new Prisma.Decimal(0),
    );

    kpis.push({
      label: "Reserved",
      value: formatKg(totalReserved.toString()),
      unit: "kg",
      icon: PackageSearch,
      accent: "violet",
      warning: totalInconsistent.greaterThan(0) ? "Some reservations need review" : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <SalesKpiSummary items={kpis} />

      <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-[5fr_7fr]">
        {canReadCustomers && attentionCustomers ? (
          <NeedsAttentionCard customers={attentionCustomers} />
        ) : null}
        {canReadOrders && ordersResult ? <ActiveOrdersCard orders={ordersResult.orders} /> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 min-[768px]:max-[1023px]:grid-cols-2 min-[1024px]:grid-cols-3">
        {canReadStock && stock ? <AvailableStockCard stock={stock} /> : null}
        {canReadReservations && reservations ? (
          <ReservationsCard reservations={reservations} />
        ) : null}
        {canReadReceivables && receivables ? (
          <ReceivablesCard
            receivables={receivables}
            className="min-[768px]:max-[1023px]:col-span-2"
          />
        ) : null}
      </div>
    </div>
  );
}
