import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getCustomerStatusLabel, CUSTOMER_STATUS_STYLES } from "@/components/sales/customer-status";
import { CustomerDetailNotes } from "@/components/sales/customer-detail-notes";
import { CustomerDetailOrders } from "@/components/sales/customer-detail-orders";
import { CustomerDetailOverview } from "@/components/sales/customer-detail-overview";
import { CustomerDetailReceivable } from "@/components/sales/customer-detail-receivable";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getSalesCustomerDetail } from "@/lib/services/sales/get-sales-customer-detail";
import { resolveSalesReadScope } from "@/lib/services/sales/read-scope";
import { cn } from "@/lib/utils";

const CUSTOMERS_READ_PERMISSION = "customers.read";
const RECEIVABLES_READ_PERMISSION = "finance.receivables.read";
const SALES_ORDERS_CREATE_PERMISSION = "sales.orders.create";

export default async function SalesCustomerDetailPage(props: PageProps<"/sales/customers/[id]">) {
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
  const canReadReceivables = permissionCodes.includes(RECEIVABLES_READ_PERMISSION);
  const canCreateOrder = permissionCodes.includes(SALES_ORDERS_CREATE_PERMISSION);

  const locale = await getCurrentLocale();
  const dictionary = getDictionary(locale);

  const { id } = await props.params;
  const customer = await getSalesCustomerDetail(user.id, id, {
    scope: readScope,
    includeReceivables: canReadReceivables,
  });

  // getSalesCustomerDetail returns null for "no such customer", "customer
  // belongs to another salesperson", and "customer is inactive" — the
  // exact same query, no separate existence check — so all three resolve
  // to the identical notFound() here.
  if (!customer) {
    notFound();
  }

  const hasNotes = customer.notes !== null && customer.notes.trim() !== "";

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath={`/sales/customers/${customer.id}`}
      dictionary={dictionary}
      showPeriodControl={false}
    >
      <div className="pb-4">
        <Link
          href="/sales/customers"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          {dictionary.customerDetail.backToCustomers}
        </Link>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
              {customer.name}
            </h1>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap",
                CUSTOMER_STATUS_STYLES[customer.status] ?? "bg-slate-100 text-slate-600",
              )}
            >
              {getCustomerStatusLabel(dictionary.status.customer, customer.status)}
            </span>
          </div>

          {canCreateOrder ? (
            <Link
              href={`/sales/orders/new?customerId=${customer.id}`}
              className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800"
            >
              {dictionary.customerDetail.newOrder}
            </Link>
          ) : null}
        </div>
        <p className="mt-1 text-[13px] text-slate-500">{customer.code}</p>
      </div>

      <div className="flex flex-col gap-4">
        <CustomerDetailOverview customer={customer} locale={locale} dictionary={dictionary} />
        <CustomerDetailOrders orders={customer.recentOrders} locale={locale} dictionary={dictionary} />

        {customer.receivables !== null && customer.receivableDetails !== null ? (
          <CustomerDetailReceivable
            receivables={customer.receivables}
            receivableDetails={customer.receivableDetails}
            locale={locale}
            dictionary={dictionary}
          />
        ) : null}

        {hasNotes ? <CustomerDetailNotes notes={customer.notes as string} dictionary={dictionary} /> : null}
      </div>
    </DashboardShell>
  );
}
