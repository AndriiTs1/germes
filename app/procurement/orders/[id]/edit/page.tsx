import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { NewPurchaseOrderForm } from "@/components/procurement/purchase-order-form/new-purchase-order-form";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getNewPurchaseOrderFormOptions } from "@/lib/services/procurement/get-new-purchase-order-form-options";
import { getPurchaseOrderDetail } from "@/lib/services/procurement/get-purchase-order-detail";
import { isPurchaseOrderCurrency } from "@/lib/validation/purchase-order";

const PROCUREMENT_ORDERS_UPDATE_PERMISSION = "procurement.orders.update";

/**
 * Edit form for a DRAFT PurchaseOrder. This is the page gate only —
 * updatePurchaseOrderAction re-checks the permission, and the service
 * re-checks that the order is still a DRAFT and unchanged since load.
 */
export default async function EditPurchaseOrderPage(props: PageProps<"/procurement/orders/[id]/edit">) {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    user = await requirePermission(PROCUREMENT_ORDERS_UPDATE_PERMISSION);
  } catch {
    redirect("/");
  }

  const { id } = await props.params;

  const [order, options, permissionCodes, locale] = await Promise.all([
    getPurchaseOrderDetail(id),
    getNewPurchaseOrderFormOptions(),
    getPermissionCodesForUser(user.id),
    getCurrentLocale(),
  ]);

  if (!order) {
    notFound();
  }

  // Only a DRAFT is editable; anything else goes back to its read-only card.
  if (order.status !== "DRAFT") {
    redirect(`/procurement/orders/${order.id}`);
  }

  const dictionary = getDictionary(locale);
  const t = dictionary.procurement.orderForm;

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath={`/procurement/orders/${order.id}`}
      dictionary={dictionary}
      showPeriodControl={false}
      showGlobalSearch={false}
    >
      <div className="pb-4">
        <Link
          href={`/procurement/orders/${order.id}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          {t.backToOrder}
        </Link>

        <h1 className="mt-3 text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
          {t.editTitle}
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">{order.orderNumber}</p>
      </div>

      <NewPurchaseOrderForm
        suppliers={options.suppliers}
        warehouses={options.warehouses}
        products={options.products}
        locale={locale}
        dictionary={t}
        edit={{
          purchaseOrderId: order.id,
          loadedUpdatedAt: order.updatedAt,
          initialValues: {
            supplierId: order.supplier.id,
            destinationWarehouseId: order.destinationWarehouse?.id ?? "",
            // A stored code outside the allowed list must be re-chosen.
            currency: isPurchaseOrderCurrency(order.currency) ? order.currency : "",
            // Stored as UTC midnight of the chosen day → the same "YYYY-MM-DD".
            expectedArrivalDate: order.expectedArrivalDate ? order.expectedArrivalDate.slice(0, 10) : "",
            notes: order.notes ?? "",
            items: order.items.map((item) => ({
              productId: item.productId,
              quantityKg: item.quantityKg,
              pricePerKg: item.pricePerKg ?? "",
            })),
          },
        }}
      />
    </DashboardShell>
  );
}
