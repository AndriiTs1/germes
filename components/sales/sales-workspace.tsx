import { CircleDollarSign, ClipboardList, PackageSearch, UserRoundCheck } from "lucide-react";
import Link from "next/link";

import { Prisma } from "@/lib/generated/prisma/client";
import { getAttentionCustomers } from "@/lib/services/sales/get-attention-customers";
import { getReceivableExposure } from "@/lib/services/sales/get-receivable-exposure";
import { getReservationsRequiringAttention } from "@/lib/services/sales/get-reservations-requiring-attention";
import { getStockAvailability } from "@/lib/services/sales/get-stock-availability";
import { getSalesTeamSummary } from "@/lib/services/sales/get-sales-team-summary";
import { ACTIVE_SALES_ORDER_STATUSES } from "@/lib/services/sales/config";
import { listSalesOrders } from "@/lib/services/sales/list-sales-orders";
import { ActiveOrdersCard } from "@/components/sales/active-orders-card";
import { AvailableStockCard } from "@/components/sales/available-stock-card";
import { NeedsAttentionCard } from "@/components/sales/needs-attention-card";
import { ReceivablesCard } from "@/components/sales/receivables-card";
import { ReservationsCard } from "@/components/sales/reservations-card";
import { formatKg, formatMoney } from "@/components/sales/format";
import { OperationalDetails } from "@/components/sales/operational-details";
import { SalesKpiSummary, type SalesKpiCardProps } from "@/components/sales/sales-kpi-row";
import { SalesTeamSummary } from "@/components/sales/sales-team-summary";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { SalesReadScope } from "@/lib/services/sales/read-scope";

const RECENT_ORDERS_LIMIT = 5;
/** Same size as the Active Orders slice and the Available Stock preview. */
const OWNER_PREVIEW_LIMIT = 5;

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

  // Read only: no ACTIVE → EXPIRED writes here. Elapsed CONFIRMED
  // reservations are simply not counted (effectiveActiveReservationWhere).
  const [attentionCustomers, ordersResult, stock, reservations, receivables, teamSummary] = await Promise.all([
    canReadCustomers ? getAttentionCustomers(userId, readScope) : Promise.resolve(null),
    canReadOrders
      ? // "Active orders" = CONFIRMED / PROCESSING / READY (as on the Owner Dashboard); drafts stay on /sales/orders.
        listSalesOrders(userId, { scope: readScope, statuses: ACTIVE_SALES_ORDER_STATUSES, limit: RECENT_ORDERS_LIMIT })
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

    let value: string | string[];
    let unit: string | undefined;

    if (withOverdue.length === 0) {
      value = "0";
    } else if (withOverdue.length === 1) {
      value = formatKg(withOverdue[0].overdueOutstanding, locale);
      unit = withOverdue[0].currency;
    } else {
      // One full amount per currency, one line each — never combined into
      // one fake total.
      value = withOverdue.map((bucket) => formatMoney(bucket.overdueOutstanding, bucket.currency, locale));
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

  // Supervisory ("all") view: a compact owner dashboard — the operational
  // cards sit behind a closed-by-default disclosure, long lists show a short
  // preview, and each card keeps its own height. The "own" (SALES) workspace
  // keeps the full operational lists exactly as before.
  const compact = readScope === "all";
  const headerLinkClass = "text-[12px] font-medium text-slate-400 transition-colors hover:text-slate-700";
  const warehouseLink =
    compact && permissionCodes.includes("workspace.warehouse.access") ? (
      <Link href="/warehouse" className={headerLinkClass}>
        {dictionary.sales.workspace.goToWarehouse}
      </Link>
    ) : undefined;
  const financeLink =
    compact && permissionCodes.includes("finance.dashboard.read") ? (
      <Link href="/finance" className={headerLinkClass}>
        {dictionary.sales.workspace.goToFinance}
      </Link>
    ) : undefined;

  // Owner layout for the lower row: wide Reservations + a side stack. Needs
  // Reservations plus at least one of the other two; otherwise (and always
  // for the "own" workspace) the original equal-column row is kept.
  const ownerComposition =
    compact &&
    Boolean(canReadReservations && reservations) &&
    Boolean((canReadReceivables && receivables) || (canReadStock && stock));

  const stockCard =
    canReadStock && stock ? (
      <AvailableStockCard
        stock={stock}
        locale={locale}
        dictionary={dictionary}
        problemsFirst={compact}
        action={warehouseLink}
      />
    ) : null;
  const reservationsCard =
    canReadReservations && reservations ? (
      <ReservationsCard reservations={reservations} locale={locale} dictionary={dictionary} compact={compact} />
    ) : null;
  const receivablesCard =
    canReadReceivables && receivables ? (
      <ReceivablesCard
        receivables={receivables}
        locale={locale}
        dictionary={dictionary}
        action={financeLink}
        className={
          !ownerComposition && secondaryCardCount === 3
            ? "md:col-span-2 lg:col-span-1"
            : undefined
        }
      />
    ) : null;

  const operational = (
    <>
      <div
        className={`grid grid-cols-1 gap-4 ${
          primaryCardCount === 2 ? "lg:grid-cols-[5fr_7fr]" : ""
        } xl:gap-3.5`}
      >
        {canReadCustomers && attentionCustomers ? (
          <NeedsAttentionCard
            customers={attentionCustomers}
            dictionary={dictionary}
            previewLimit={compact ? OWNER_PREVIEW_LIMIT : undefined}
          />
        ) : null}
        {canReadOrders && ordersResult ? (
          <ActiveOrdersCard
            orders={ordersResult.orders}
            locale={locale}
            dictionary={dictionary}
            viewAllHref={compact ? "/sales/orders?status=active" : undefined}
            totalCount={compact ? ordersResult.totalCount : undefined}
            viewAllInFooter={compact}
          />
        ) : null}
      </div>

      {ownerComposition ? (
        // Owner composition: Reservations (the main operational risk) as the
        // wide card, Receivables over Available Stock as a narrow side stack.
        // Tablet: Reservations full width, the two summaries side by side.
        // Mobile: one column, same order. The row stretches, so Reservations
        // is never shorter than the stack; the stack's cards keep their own
        // height (content-start) even when Reservations is expanded, and the
        // tablet pair shares one height.
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[7fr_5fr] xl:gap-3.5">
          {reservationsCard}
          <div className="grid grid-cols-1 content-start gap-4 md:grid-cols-2 lg:grid-cols-1 xl:gap-3.5">
            {receivablesCard}
            {stockCard}
          </div>
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 gap-4 ${
            secondaryCardCount >= 2 ? "md:grid-cols-2" : ""
          } ${secondaryCardCount === 3 ? "lg:grid-cols-3" : ""} ${compact ? "items-start" : ""} xl:gap-3.5`}
        >
          {stockCard}
          {reservationsCard}
          {receivablesCard}
        </div>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-4 xl:gap-3.5">
      <SalesKpiSummary items={kpis} />

      {teamSummary ? (
        <SalesTeamSummary summary={teamSummary} locale={locale} dictionary={dictionary} />
      ) : null}

      {compact ? (
        <OperationalDetails
          title={dictionary.sales.workspace.operationalDetails.title}
          showLabel={dictionary.sales.workspace.operationalDetails.show}
          hideLabel={dictionary.sales.workspace.operationalDetails.hide}
        >
          {operational}
        </OperationalDetails>
      ) : (
        operational
      )}
    </div>
  );
}
