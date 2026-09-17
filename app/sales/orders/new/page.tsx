import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { NewOrderForm } from "@/components/sales/order-form/new-order-form";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getNewOrderFormOptions } from "@/lib/services/sales/get-new-order-form-options";

const SALES_ORDERS_CREATE_PERMISSION = "sales.orders.create";

export default async function NewSalesOrderPage(props: PageProps<"/sales/orders/new">) {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    // Same reasoning as every other /sales/* route: any failure here
    // (unauthenticated or missing this permission) is safest resolved by
    // "/", which re-derives the correct destination from the user's real
    // permissions. This is the page gate only — the server action
    // independently re-checks the same permission before writing anything.
    user = await requirePermission(SALES_ORDERS_CREATE_PERMISSION);
  } catch {
    redirect("/");
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);
  const options = await getNewOrderFormOptions(user.id);

  const searchParams = await props.searchParams;
  const requestedCustomerId =
    typeof searchParams?.customerId === "string" ? searchParams.customerId : undefined;

  // Preselection is only ever applied when the id matches one of the
  // already server-scoped allowed options — otherwise it's silently
  // dropped, never revealing whether a non-matching customer id exists.
  const initialCustomerId = options.customers.some((customer) => customer.id === requestedCustomerId)
    ? requestedCustomerId
    : undefined;

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath="/sales/orders/new"
      showPeriodControl={false}
    >
      <div className="pb-4">
        <Link
          href="/sales/orders"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Back to Orders
        </Link>

        <h1 className="mt-3 text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
          New Order
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">Create a sales order for a customer</p>
      </div>

      <NewOrderForm
        customers={options.customers}
        products={options.products}
        initialCustomerId={initialCustomerId}
      />
    </DashboardShell>
  );
}
