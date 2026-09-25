import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  CustomersFilters,
  type CustomersStatusFilter,
} from "@/components/sales/customers-filters";
import { CustomersList } from "@/components/sales/customers-list";
import { CustomersPagination } from "@/components/sales/customers-pagination";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { listSalesCustomers } from "@/lib/services/sales/list-sales-customers";
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

  const result = await listSalesCustomers(user.id, {
    scope: readScope,
    limit: PAGE_SIZE,
    page: requestedPage,
    search: q || undefined,
    status: status === "all" ? undefined : status,
  });

  if (requestedPage > result.pageCount) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status !== "all") params.set("status", status);
    if (result.pageCount > 1) params.set("page", String(result.pageCount));

    const query = params.toString();
    redirect(query ? `/sales/customers?${query}` : "/sales/customers");
  }

  const hasActiveFilter = q.length > 0 || status !== "all";
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
        <CustomersFilters q={q} status={status} dictionary={dictionary} />
        <CustomersList customers={result.items} emptyMessage={emptyMessage} locale={locale} dictionary={dictionary} />
        <CustomersPagination
          page={result.page}
          pageCount={result.pageCount}
          q={q}
          status={status}
          dictionary={dictionary}
        />
      </div>
    </DashboardShell>
  );
}
