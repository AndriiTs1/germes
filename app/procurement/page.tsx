import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";

const PROCUREMENT_OVERVIEW_PERMISSION = "procurement.overview.read";
const PROCUREMENT_ORDERS_CREATE_PERMISSION = "procurement.orders.create";

/**
 * Procurement landing page. The Supplier Directory now lives only at
 * /procurement/suppliers and purchase orders at /procurement/orders; the
 * truthful operational content for this page is added in a later step.
 */
export default async function ProcurementPage() {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    // Same reasoning as every other workspace route (/sales, /warehouse):
    // any failure here (unauthenticated or missing this permission) is
    // safest resolved by "/", which re-derives the correct destination from
    // the user's real permissions.
    user = await requirePermission(PROCUREMENT_OVERVIEW_PERMISSION);
  } catch {
    redirect("/");
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);

  const locale = await getCurrentLocale();
  const dictionary = getDictionary(locale);

  // Navigation only — opens the DRAFT create form, which (and whose
  // action) independently re-checks this same permission.
  const canCreatePurchaseOrder = permissionCodes.includes(PROCUREMENT_ORDERS_CREATE_PERMISSION);

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath="/procurement"
      dictionary={dictionary}
      showPeriodControl={false}
      // The global header search isn't wired for the Procurement workspace
      // (same as /procurement/orders and /procurement/suppliers).
      showGlobalSearch={false}
    >
      <div className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
              {dictionary.procurement.workspace.title}
            </h1>
            <p className="mt-1 text-[13px] text-slate-500">{dictionary.procurement.workspace.subtitle}</p>
          </div>

          {canCreatePurchaseOrder ? (
            <Link
              href="/procurement/orders/new"
              className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800"
            >
              {dictionary.procurement.workspace.createOrder}
            </Link>
          ) : null}
        </div>
      </div>
    </DashboardShell>
  );
}
