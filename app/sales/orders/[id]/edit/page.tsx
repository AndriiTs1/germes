import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { EditOrderForm } from "@/components/sales/order-form/edit-order-form";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getNewOrderFormOptions } from "@/lib/services/sales/get-new-order-form-options";
import { getSalesOrderForEdit } from "@/lib/services/sales/get-sales-order-for-edit";

const SALES_ORDERS_UPDATE_PERMISSION = "sales.orders.update";

export default async function EditSalesOrderPage(props: PageProps<"/sales/orders/[id]/edit">) {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    // Same reasoning as every other /sales/* route: any failure here
    // (unauthenticated or missing this permission) is safest resolved by
    // "/", which re-derives the correct destination from the user's real
    // permissions. This is the page gate only — the server action
    // independently re-checks the same permission before writing anything.
    user = await requirePermission(SALES_ORDERS_UPDATE_PERMISSION);
  } catch {
    redirect("/");
  }

  const { id } = await props.params;

  const [order, options, permissionCodes] = await Promise.all([
    getSalesOrderForEdit(user.id, id),
    getNewOrderFormOptions(user.id),
    getPermissionCodesForUser(user.id),
  ]);

  // getSalesOrderForEdit returns null for "no such order", "belongs to
  // another salesperson", AND "not DRAFT" — the exact same query, no
  // separate existence check — so all three resolve to the identical
  // notFound() here, same convention as /sales/orders/[id].
  if (!order) {
    notFound();
  }

  const locale = await getCurrentLocale();
  const dictionary = getDictionary(locale);

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath={`/sales/orders/${order.id}`}
      dictionary={dictionary}
      showPeriodControl={false}
    >
      <div className="pb-4">
        <Link
          href={`/sales/orders/${order.id}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          {dictionary.orderForm.backToOrder}
        </Link>

        <h1 className="mt-3 text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
          {dictionary.orderForm.editTitle}
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">{order.orderNumber}</p>
      </div>

      <EditOrderForm
        order={order}
        customers={options.customers}
        products={options.products}
        locale={locale}
        dictionary={dictionary.orderForm}
      />
    </DashboardShell>
  );
}
