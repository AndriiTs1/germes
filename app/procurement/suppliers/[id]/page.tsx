import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SupplierDetailOverview } from "@/components/procurement/supplier-detail-overview";
import { getSupplierStatusLabel, SUPPLIER_STATUS_STYLES } from "@/components/procurement/supplier-status";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getSupplierDetail } from "@/lib/services/procurement/get-supplier-detail";
import { cn } from "@/lib/utils";

const PROCUREMENT_OVERVIEW_PERMISSION = "procurement.overview.read";
const SUPPLIERS_READ_PERMISSION = "suppliers.read";

/**
 * Read-only Supplier card. Access is exactly the directory's
 * (/procurement/suppliers): procurement.overview.read AND suppliers.read,
 * both enforced here on the server — whoever can see a row can open it,
 * nobody else can.
 */
export default async function SupplierDetailPage(props: PageProps<"/procurement/suppliers/[id]">) {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    // Same reasoning as every other workspace route: any failure here is
    // safest resolved by "/", which re-derives the correct destination.
    user = await requirePermission(PROCUREMENT_OVERVIEW_PERMISSION);
  } catch {
    redirect("/");
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);

  if (!permissionCodes.includes(SUPPLIERS_READ_PERMISSION)) {
    redirect("/");
  }

  const locale = await getCurrentLocale();
  const dictionary = getDictionary(locale);
  const t = dictionary.procurement.supplierDetail;

  const { id } = await props.params;
  const supplier = await getSupplierDetail(id);

  if (!supplier) {
    notFound();
  }

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath={`/procurement/suppliers/${supplier.id}`}
      dictionary={dictionary}
      showPeriodControl={false}
      showGlobalSearch={false}
    >
      <div className="pb-4">
        <Link
          href="/procurement/suppliers"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          {t.backToSuppliers}
        </Link>

        <div className="mt-3 flex min-w-0 items-center gap-3">
          <h1 className="truncate text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
            {supplier.name}
          </h1>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap",
              SUPPLIER_STATUS_STYLES[supplier.status] ?? "bg-slate-100 text-slate-600",
            )}
          >
            {getSupplierStatusLabel(dictionary.status.supplier, supplier.status)}
          </span>
        </div>
        <p className="mt-1 truncate text-[13px] text-slate-500">
          {supplier.country ? `${supplier.code} · ${supplier.country}` : supplier.code}
        </p>
      </div>

      <SupplierDetailOverview supplier={supplier} dictionary={dictionary} />
    </DashboardShell>
  );
}
