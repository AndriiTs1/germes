import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CUSTOMER_STATUS_LABELS, CUSTOMER_STATUS_STYLES } from "@/components/sales/customer-status";
import { CustomerDetailNotes } from "@/components/sales/customer-detail-notes";
import { CustomerDetailOrders } from "@/components/sales/customer-detail-orders";
import { CustomerDetailOverview } from "@/components/sales/customer-detail-overview";
import { CustomerDetailReceivable } from "@/components/sales/customer-detail-receivable";
import { logout } from "@/lib/auth/actions";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getSalesCustomerDetail } from "@/lib/services/sales/get-sales-customer-detail";
import { cn } from "@/lib/utils";

const CUSTOMERS_READ_PERMISSION = "customers.read";
const RECEIVABLES_READ_PERMISSION = "finance.receivables.read";

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
  const canReadReceivables = permissionCodes.includes(RECEIVABLES_READ_PERMISSION);

  const { id } = await props.params;
  const customer = await getSalesCustomerDetail(user.id, id, {
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
      showPeriodControl={false}
    >
      <div className="pb-4">
        <Link
          href="/sales/customers"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Back to Customers
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
              {CUSTOMER_STATUS_LABELS[customer.status] ?? customer.status}
            </span>
          </div>

          <form action={logout}>
            <button
              type="submit"
              className="shrink-0 text-[13px] font-medium text-slate-500 hover:text-slate-700"
            >
              Sign out
            </button>
          </form>
        </div>
        <p className="mt-1 text-[13px] text-slate-500">{customer.code}</p>
      </div>

      <div className="flex flex-col gap-4">
        <CustomerDetailOverview customer={customer} />
        <CustomerDetailOrders orders={customer.recentOrders} />

        {customer.receivables !== null && customer.receivableDetails !== null ? (
          <CustomerDetailReceivable
            receivables={customer.receivables}
            receivableDetails={customer.receivableDetails}
          />
        ) : null}

        {hasNotes ? <CustomerDetailNotes notes={customer.notes as string} /> : null}
      </div>
    </DashboardShell>
  );
}
