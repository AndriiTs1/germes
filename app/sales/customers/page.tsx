import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  CustomersFilters,
  type CustomersStatusFilter,
} from "@/components/sales/customers-filters";
import { CustomersList } from "@/components/sales/customers-list";
import { CustomersPagination } from "@/components/sales/customers-pagination";
import { ManagerFilterChip } from "@/components/sales/manager-filter-chip";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { listSalesCustomers } from "@/lib/services/sales/list-sales-customers";
import { getSalesManager } from "@/lib/services/sales/get-sales-manager";
import { resolveSalesReadScope } from "@/lib/services/sales/read-scope";

const CUSTOMERS_READ_PERMISSION = "customers.read";
const PAGE_SIZE = 20;
const VALID_STATUSES: CustomersStatusFilter[] = ["ACTIVE", "POTENTIAL", "INACTIVE", "BLOCKED"];

function parseStatusFilter(value: string | undefined): CustomersStatusFilter {
  if (value && (VALID_STATUSES as string[]).includes(value)) {
    return value as CustomersStatusFilter;
  }
  return "all";
}

export default async function SalesCustomersPage(props: PageProps<"/sales/customers">) {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    // Same reasoning as every other /sales/* route: any failure here
    // (unauthenticated or missing this permission) is safest resolved by
    // "/", which re-derives the correct destination from the user's real
    // permissions.
    user = await requirePermission(CUSTOMERS_READ_PERMISSION);
  } catch {
    redirect("/");
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);
  const roleCodes = user.roles.map((entry) => entry.role.code);
  const readScope = resolveSalesReadScope(roleCodes);

  const locale = await getCurrentLocale();
  const dictionary = getDictionary(locale);

  const searchParams = await props.searchParams;
  const q = typeof searchParams?.q === "string" ? searchParams.q.trim() : "";
  const status = parseStatusFilter(
    typeof searchParams?.status === "string" ? searchParams.status : undefined,
  );
  const rawPage = typeof searchParams?.page === "string" ? Number(searchParams.page) : 1;
  const requestedPage = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  // ?manager= is only ever honoured for the supervisory ("all") scope; for
  // SALES it is dropped here (and again by resolveResponsibleFilter in the
  // service), so their links and results stay exactly as without it.
  const rawManager = typeof searchParams?.manager === "string" ? searchParams.manager.trim() : "";
  const managerId = readScope === "all" && rawManager ? rawManager : undefined;
  const manager = managerId ? await getSalesManager(managerId) : null;

  // Base filter params (status + q) shared by the manager-less links below.
  const baseParams = new URLSearchParams();
  if (status !== "all") baseParams.set("status", status);
  if (q) baseParams.set("q", q);
  const baseQuery = baseParams.toString();
  const hrefWithoutManager = baseQuery ? `/sales/customers?${baseQuery}` : "/sales/customers";

  if (managerId && !manager) {
    // Unknown or non-SALES id: drop the filter rather than show an empty,
    // unexplained list.
    redirect(hrefWithoutManager);
  }

  const result = await listSalesCustomers(user.id, {
    scope: readScope,
    managerId,
    limit: PAGE_SIZE,
    page: requestedPage,
    search: q || undefined,
    status: status === "all" ? undefined : status,
  });

  if (requestedPage > result.pageCount) {
    const params = new URLSearchParams();
    if (managerId) params.set("manager", managerId);
    if (q) params.set("q", q);
    if (status !== "all") params.set("status", status);
    if (result.pageCount > 1) params.set("page", String(result.pageCount));

    const query = params.toString();
    redirect(query ? `/sales/customers?${query}` : "/sales/customers");
  }

  const hasActiveFilter = q.length > 0 || status !== "all" || Boolean(managerId);
  const emptyMessage = hasActiveFilter ? dictionary.customers.emptyFiltered : dictionary.customers.emptyDefault;

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath="/sales/customers"
      dictionary={dictionary}
      showPeriodControl={false}
    >
      <div className="pb-4">
        <h1 className="text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
          {dictionary.customers.title}
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">{dictionary.customers.subtitle}</p>
      </div>

      <div className="flex flex-col gap-4">
        {manager ? (
          <ManagerFilterChip
            managerName={manager.name ?? manager.email}
            clearHref={hrefWithoutManager}
            otherListHref={`/sales/orders?manager=${encodeURIComponent(manager.id)}`}
            labels={{
              prefix: dictionary.common.managerFilter.label,
              clear: dictionary.common.managerFilter.clear,
              otherList: dictionary.common.managerFilter.viewOrders,
            }}
          />
        ) : null}
        <CustomersFilters q={q} status={status} manager={managerId} dictionary={dictionary} />
        <CustomersList showResponsible={readScope === "all"} customers={result.items} emptyMessage={emptyMessage} locale={locale} dictionary={dictionary} />
        <CustomersPagination
          page={result.page}
          pageCount={result.pageCount}
          q={q}
          status={status}
          manager={managerId}
          dictionary={dictionary}
        />
      </div>
    </DashboardShell>
  );
}
