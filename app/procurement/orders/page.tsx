import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  buildPurchaseOrderListHref,
  PURCHASE_ORDER_STATUSES,
  type PurchaseOrderStatusFilter,
} from "@/components/procurement/purchase-order-list-url";
import { PurchaseOrdersFilters } from "@/components/procurement/purchase-orders-filters";
import { PurchaseOrdersList } from "@/components/procurement/purchase-orders-list";
import { PurchaseOrdersPagination } from "@/components/procurement/purchase-orders-pagination";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { listPurchaseOrders } from "@/lib/services/procurement/list-purchase-orders";

const PROCUREMENT_ORDERS_READ_PERMISSION = "procurement.orders.read";
const PROCUREMENT_ORDERS_CREATE_PERMISSION = "procurement.orders.create";

/** Only exact PurchaseOrderStatus enum values are accepted from the URL; anything else = all. */
function parseStatusFilter(value: string | undefined): PurchaseOrderStatusFilter {
  return value && (PURCHASE_ORDER_STATUSES as readonly string[]).includes(value)
    ? (value as PurchaseOrderStatusFilter)
    : "all";
}

/**
 * Read-only PurchaseOrder list. Every holder of procurement.orders.read
 * (currently OWNER, ADMIN, PROCUREMENT) sees every order — no createdById
 * scope. The create button is gated separately on procurement.orders.create.
 */
export default async function PurchaseOrdersPage(props: PageProps<"/procurement/orders">) {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    // Same reasoning as every other workspace route: any failure here is
    // safest resolved by "/", which re-derives the correct destination.
    user = await requirePermission(PROCUREMENT_ORDERS_READ_PERMISSION);
  } catch {
    redirect("/");
  }

  const [permissionCodes, locale, searchParams] = await Promise.all([
    getPermissionCodesForUser(user.id),
    getCurrentLocale(),
    props.searchParams,
  ]);
  const dictionary = getDictionary(locale);
  const t = dictionary.procurement.ordersList;
  const canCreate = permissionCodes.includes(PROCUREMENT_ORDERS_CREATE_PERMISSION);

  const rawQ = typeof searchParams?.q === "string" ? searchParams.q : undefined;
  const q = rawQ?.trim() ?? "";
  const status = parseStatusFilter(typeof searchParams?.status === "string" ? searchParams.status : undefined);
  const rawPage = typeof searchParams?.page === "string" ? Number(searchParams.page) : 1;
  const requestedPage = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  // Canonical search URL, same as the supplier directory: "   PO   " →
  // ?q=PO and an empty q= is dropped. An unknown status is simply treated
  // as "all" (also as there).
  if (rawQ !== undefined && (rawQ !== q || q === "")) {
    redirect(buildPurchaseOrderListHref({ q, status }));
  }

  const result = await listPurchaseOrders({
    q: q || undefined,
    status: status === "all" ? undefined : status,
    page: requestedPage,
  });

  if (requestedPage > result.pageCount) {
    redirect(buildPurchaseOrderListHref({ q, status, page: result.pageCount }));
  }

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath="/procurement/orders"
      dictionary={dictionary}
      showPeriodControl={false}
      // The list has its own search; the global header search isn't wired
      // for the Procurement workspace (same as /procurement).
      showGlobalSearch={false}
    >
      <div className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
              {t.title}
            </h1>
            <p className="mt-1 text-[13px] text-slate-500">{t.subtitle}</p>
          </div>

          {canCreate ? (
            <Link
              href="/procurement/orders/new"
              className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800"
            >
              {t.createOrder}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <PurchaseOrdersFilters q={q} status={status} dictionary={dictionary} />
        <PurchaseOrdersList
          orders={result.items}
          hasAnyOrders={result.allCount > 0}
          canCreate={canCreate}
          clearFiltersHref={buildPurchaseOrderListHref({ q: "", status: "all" })}
          locale={locale}
          dictionary={dictionary}
        />
        <PurchaseOrdersPagination
          page={result.page}
          pageCount={result.pageCount}
          query={{ q, status }}
          dictionary={dictionary}
        />
      </div>
    </DashboardShell>
  );
}
