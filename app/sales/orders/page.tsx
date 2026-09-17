import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OrdersFilters, type OrdersStatusFilter } from "@/components/sales/orders-filters";
import { OrdersList } from "@/components/sales/orders-list";
import { OrdersPagination } from "@/components/sales/orders-pagination";
import { SalesOrderStatus } from "@/lib/generated/prisma/client";
import { logout } from "@/lib/auth/actions";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import {
  listSalesOrders,
  type ListSalesOrdersOptions,
} from "@/lib/services/sales/list-sales-orders";

const SALES_ORDERS_PERMISSION = "sales.orders.read";
const SALES_ORDERS_CREATE_PERMISSION = "sales.orders.create";
const PAGE_SIZE = 20;

function parseStatusFilter(value: string | undefined): OrdersStatusFilter {
  if (value === "active" || value === "completed" || value === "cancelled") return value;
  return "all";
}

function statusFilterToOptions(
  filter: OrdersStatusFilter,
): Pick<ListSalesOrdersOptions, "onlyActive" | "status"> {
  switch (filter) {
    case "active":
      return { onlyActive: true };
    case "completed":
      return { status: SalesOrderStatus.COMPLETED };
    case "cancelled":
      return { status: SalesOrderStatus.CANCELLED };
    default:
      return {};
  }
}

export default async function SalesOrdersPage(props: PageProps<"/sales/orders">) {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    // Same reasoning as /sales itself: any failure (unauthenticated or
    // missing this permission) is safest resolved by "/", which re-derives
    // the correct destination from the user's real permissions.
    user = await requirePermission(SALES_ORDERS_PERMISSION);
  } catch {
    redirect("/");
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);

  const searchParams = await props.searchParams;
  const q = typeof searchParams?.q === "string" ? searchParams.q.trim() : "";
  const status = parseStatusFilter(
    typeof searchParams?.status === "string" ? searchParams.status : undefined,
  );
  const rawPage = typeof searchParams?.page === "string" ? Number(searchParams.page) : 1;
  const requestedPage = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  const result = await listSalesOrders(user.id, {
    limit: PAGE_SIZE,
    page: requestedPage,
    search: q || undefined,
    ...statusFilterToOptions(status),
  });

  if (requestedPage > result.pageCount) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status !== "all") params.set("status", status);
    if (result.pageCount > 1) params.set("page", String(result.pageCount));

    const query = params.toString();
    redirect(query ? `/sales/orders?${query}` : "/sales/orders");
  }

  const hasActiveFilter = q.length > 0 || status !== "all";
  const emptyMessage = hasActiveFilter ? "No orders match these filters" : "No orders yet";
  const canCreateOrder = permissionCodes.includes(SALES_ORDERS_CREATE_PERMISSION);

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath="/sales/orders"
      showPeriodControl={false}
    >
      <div className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
              Orders
            </h1>
            <p className="mt-1 text-[13px] text-slate-500">Manage and track your sales orders</p>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            {canCreateOrder ? (
              <Link
                href="/sales/orders/new"
                className="rounded-full bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800"
              >
                + New Order
              </Link>
            ) : null}

            <form action={logout}>
              <button
                type="submit"
                className="text-[13px] font-medium text-slate-500 hover:text-slate-700"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <OrdersFilters q={q} status={status} />
        <OrdersList orders={result.orders} emptyMessage={emptyMessage} />
        <OrdersPagination page={result.page} pageCount={result.pageCount} q={q} status={status} />
      </div>
    </DashboardShell>
  );
}
