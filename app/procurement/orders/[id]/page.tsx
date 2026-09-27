import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PurchaseOrderDetailItems } from "@/components/procurement/purchase-order-detail-items";
import { PurchaseOrderDetailOverview } from "@/components/procurement/purchase-order-detail-overview";
import {
  getPurchaseOrderStatusLabel,
  PURCHASE_ORDER_STATUS_STYLES,
} from "@/components/procurement/purchase-order-status";
import { DetailSection } from "@/components/sales/detail-section";
import { formatShortDate } from "@/components/sales/format";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getPurchaseOrderDetail } from "@/lib/services/procurement/get-purchase-order-detail";
import { cn } from "@/lib/utils";

const PROCUREMENT_ORDERS_READ_PERMISSION = "procurement.orders.read";

/**
 * Read-only PurchaseOrder detail. Every holder of procurement.orders.read
 * (currently OWNER, ADMIN, PROCUREMENT) sees the same facts — there is no
 * createdById scope and no operational action on this page yet.
 */
export default async function PurchaseOrderDetailPage(props: PageProps<"/procurement/orders/[id]">) {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    // Same reasoning as every other workspace route: any failure here
    // (unauthenticated or missing this permission) is safest resolved by
    // "/", which re-derives the correct destination from the user's real
    // permissions.
    user = await requirePermission(PROCUREMENT_ORDERS_READ_PERMISSION);
  } catch {
    redirect("/");
  }

  // Needed only by DashboardShell for the sidebar; nothing on this page is
  // gated on an additional permission yet.
  const permissionCodes = await getPermissionCodesForUser(user.id);

  const locale = await getCurrentLocale();
  const dictionary = getDictionary(locale);
  const t = dictionary.procurement.orderDetail;

  const { id } = await props.params;
  const order = await getPurchaseOrderDetail(id);

  if (!order) {
    notFound();
  }

  const hasNotes = order.notes !== null && order.notes.trim() !== "";

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath={`/procurement/orders/${order.id}`}
      dictionary={dictionary}
      showPeriodControl={false}
    >
      <div className="pb-4 xl:pb-3">
        <Link
          href="/procurement/orders"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          {t.backToProcurement}
        </Link>

        <div className="mt-3 flex min-w-0 items-center gap-3">
          <h1 className="truncate text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5] xl:leading-[1.2]">
            {order.orderNumber}
          </h1>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap",
              PURCHASE_ORDER_STATUS_STYLES[order.status] ?? "bg-slate-100 text-slate-600",
            )}
          >
            {getPurchaseOrderStatusLabel(dictionary.status.purchaseOrder, order.status)}
          </span>
        </div>
        <p className="mt-1 truncate text-[13px] text-slate-500">
          {t.title} · {order.supplier.name} ·{" "}
          {t.createdOn.replace("{date}", formatShortDate(order.createdAt, locale))}
        </p>
      </div>

      <div className="flex flex-col gap-4 xl:gap-3">
        <PurchaseOrderDetailOverview order={order} locale={locale} dictionary={dictionary} />
        <PurchaseOrderDetailItems
          items={order.items}
          currency={order.currency}
          locale={locale}
          dictionary={dictionary}
        />

        {hasNotes ? (
          <DetailSection title={t.notes.title}>
            <p className="text-[13px] whitespace-pre-line text-slate-700">{order.notes}</p>
          </DetailSection>
        ) : null}
      </div>
    </DashboardShell>
  );
}
