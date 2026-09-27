import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { NewPurchaseOrderForm } from "@/components/procurement/purchase-order-form/new-purchase-order-form";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getNewPurchaseOrderFormOptions } from "@/lib/services/procurement/get-new-purchase-order-form-options";

const PROCUREMENT_ORDERS_CREATE_PERMISSION = "procurement.orders.create";

export default async function NewPurchaseOrderPage() {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    // Same reasoning as every other workspace route: any failure here
    // (unauthenticated or missing this permission) is safest resolved by
    // "/". This is the page gate only — createPurchaseOrderAction
    // independently re-checks the same permission before writing anything.
    user = await requirePermission(PROCUREMENT_ORDERS_CREATE_PERMISSION);
  } catch {
    redirect("/");
  }

  const [permissionCodes, options, locale] = await Promise.all([
    getPermissionCodesForUser(user.id),
    getNewPurchaseOrderFormOptions(),
    getCurrentLocale(),
  ]);
  const dictionary = getDictionary(locale);
  const t = dictionary.procurement.orderForm;

  // A DRAFT needs a supplier and at least one product; without either the
  // form could never be submitted successfully. No warehouse is fine —
  // it's optional in a DRAFT.
  const blockingMessage =
    options.suppliers.length === 0
      ? t.noEligibleSuppliers
      : options.products.length === 0
        ? t.noActiveProducts
        : null;

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath="/procurement/orders/new"
      dictionary={dictionary}
      showPeriodControl={false}
      // Same as /procurement: the global header search targets customers/
      // orders/products and isn't wired for the Procurement workspace.
      showGlobalSearch={false}
    >
      <div className="pb-4">
        <Link
          href="/procurement"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          {t.backToProcurement}
        </Link>

        <h1 className="mt-3 text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
          {t.newTitle}
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">{t.newSubtitle}</p>
      </div>

      {blockingMessage ? (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06)]">
          <p className="text-[13px] text-slate-600">{blockingMessage}</p>
          <Link
            href="/procurement"
            className="mt-3 inline-flex rounded-full border border-slate-200/70 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            {t.backToProcurement}
          </Link>
        </div>
      ) : (
        <NewPurchaseOrderForm
          suppliers={options.suppliers}
          warehouses={options.warehouses}
          products={options.products}
          locale={locale}
          dictionary={t}
        />
      )}
    </DashboardShell>
  );
}
