import { CircleDollarSign, ClipboardList, PackageSearch, UserRoundCheck } from "lucide-react";

import { Prisma } from "@/lib/generated/prisma/client";
import { getAttentionCustomers } from "@/lib/services/sales/get-attention-customers";
import { getReceivableExposure } from "@/lib/services/sales/get-receivable-exposure";
import { expireStockReservations } from "@/lib/services/sales/expire-stock-reservations";
import { getReservationsRequiringAttention } from "@/lib/services/sales/get-reservations-requiring-attention";
import { getStockAvailability } from "@/lib/services/sales/get-stock-availability";
import { getSalesTeamSummary } from "@/lib/services/sales/get-sales-team-summary";
import { listSalesOrders } from "@/lib/services/sales/list-sales-orders";
import { ActiveOrdersCard } from "@/components/sales/active-orders-card";
import { AvailableStockCard } from "@/components/sales/available-stock-card";
import { NeedsAttentionCard } from "@/components/sales/needs-attention-card";
import { ReceivablesCard } from "@/components/sales/receivables-card";
import { ReservationsCard } from "@/components/sales/reservations-card";
import { formatKg } from "@/components/sales/format";
import { SalesKpiSummary, type SalesKpiCardProps } from "@/components/sales/sales-kpi-row";
import { SalesTeamSummary } from "@/components/sales/sales-team-summary";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { SalesReadScope } from "@/lib/services/sales/read-scope";

const RECENT_ORDERS_LIMIT = 5;

type SalesWorkspaceProps = {
  userId: string;
  permissionCodes: string[];
  readScope: SalesReadScope;
  locale: Locale;
  dictionary: Dictionary;
};

/**
 * Permission-gated data orchestration for /sales. Per-widget permission
 * checks happen here, BEFORE each service call — never "fetch everything
 * then hide cards", since that would fetch data the user isn't entitled
 * to see. Each service stays permission-agnostic, as designed in Stage 8C;
 * all authorization decisions live in this Server Component instead.
 */
export async function SalesWorkspace({
  userId,
  permissionCodes,
  readScope,
  locale,
  dictionary,
}: SalesWorkspaceProps) {
  const canReadCustomers = permissionCodes.includes("customers.read");
  const canReadOrders = permissionCodes.includes("sales.orders.read");
  const canReadStock = permissionCodes.includes("inventory.stock.read");
  const canReadReservations = permissionCodes.includes("sales.reservations.read");
  const canReadReceivables = permissionCodes.includes("finance.receivables.read");
  // Supervisory team block — only ever fetched/rendered for the "all" read
  // scope; the "own" (SALES) path never calls getSalesTeamSummary.
  const showTeam = readScope === "all" && canReadCustomers && canReadOrders;

  if (canReadStock || canReadReservations) {
    await expireStockReservations();
  }

  const [attentionCustomers, ordersResult, stock, reservations, receivables, teamSummary] = await Promise.all([
    canReadCustomers ? getAttentionCustomers(userId, readScope) : Promise.resolve(null),
    canReadOrders
      ? listSalesOrders(userId, { scope: readScope, onlyActive: true, limit: RECENT_ORDERS_LIMIT })
      : Promise.resolve(null),
    canReadStock ? getStockAvailability() : Promise.resolve(null),
    canReadReservations ? getReservationsRequiringAttention(userId, readScope) : Promise.resolve(null),
    canReadReceivables ? getReceivableExposure(userId, readScope) : Promise.resolve(null),
    showTeam ? getSalesTeamSummary() : Promise.resolve(null),
  ]);

  const kpi = dictionary.sales.workspace.kpi;
  const kpis: SalesKpiCardProps[] = [];

  if (attentionCustomers) {
    kpis.push({
      label: kpi.needsAttention,
      value: String(attentionCustomers.length),
      icon: UserRoundCheck,
      accent: "rose",
    });
  }

  if (ordersResult) {
    kpis.push({
      label: kpi.activeOrders,
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
      value = formatKg(withOverdue[0].overdueOutstanding, locale);
      unit = withOverdue[0].currency;
    } else {
      // Never combine currencies into one fake total — show a compact,
      // currency-safe count instead. Individual values remain available
      // in the Receivables card itself.
      value = String(withOverdue.length);
      unit = kpi.currenciesUnit;
    }

    kpis.push({ label: kpi.overdueAr, value, unit, icon: CircleDollarSign, accent: "amber" });
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
      label: kpi.reserved,
      value: formatKg(totalReserved.toString(), locale),
      unit: dictionary.common.kgUnit,
      icon: PackageSearch,
      accent: "violet",
      warning: totalInconsistent.greaterThan(0) ? kpi.reservationsNeedReview : undefined,
    });
  }

  const primaryCardCount =
    Number(Boolean(canReadCustomers && attentionCustomers)) +
    Number(Boolean(canReadOrders && ordersResult));

  const secondaryCardCount =
    Number(Boolean(canReadStock && stock)) +
    Number(Boolean(canReadReservations && reservations)) +
    Number(Boolean(canReadReceivables && receivables));

  return (
    <div className="flex flex-col gap-4 xl:gap-3.5">
      <SalesKpiSummary items={kpis} />

      {teamSummary ? (
        <SalesTeamSummary summary={teamSummary} locale={locale} dictionary={dictionary} />
      ) : null}

      <div
        className={`grid grid-cols-1 gap-4 ${
          primaryCardCount === 2 ? "lg:grid-cols-[5fr_7fr]" : ""
        } xl:gap-3.5`}
      >
        {canReadCustomers && attentionCustomers ? (
          <NeedsAttentionCard customers={attentionCustomers} dictionary={dictionary} />
        ) : null}
        {canReadOrders && ordersResult ? (
          <ActiveOrdersCard orders={ordersResult.orders} locale={locale} dictionary={dictionary} />
        ) : null}
      </div>

      <div
        className={`grid grid-cols-1 gap-4 ${
          secondaryCardCount >= 2 ? "md:grid-cols-2" : ""
        } ${secondaryCardCount === 3 ? "lg:grid-cols-3" : ""} xl:gap-3.5`}
      >
        {canReadStock && stock ? (
          <AvailableStockCard stock={stock} locale={locale} dictionary={dictionary} />
        ) : null}
        {canReadReservations && reservations ? (
          <ReservationsCard reservations={reservations} locale={locale} dictionary={dictionary} />
        ) : null}
        {canReadReceivables && receivables ? (
          <ReceivablesCard
            receivables={receivables}
            locale={locale}
            dictionary={dictionary}
            className={
              secondaryCardCount === 3
                ? "md:col-span-2 lg:col-span-1"
                : undefined
            }
          />
        ) : null}
      </div>
    </div>
  );
}
