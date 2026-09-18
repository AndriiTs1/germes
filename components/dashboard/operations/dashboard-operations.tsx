import { NeedsAttention } from "@/components/dashboard/operations/needs-attention";
import { PaymentCalendar } from "@/components/dashboard/operations/payment-calendar";
import { RecentOrders } from "@/components/dashboard/operations/recent-orders";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

export function DashboardOperations({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  return (
    <div className="grid grid-cols-1 gap-4 min-[768px]:max-[1439px]:grid-cols-2 min-[1440px]:grid-cols-[1.35fr_1fr_1fr]">
      <NeedsAttention className="min-[768px]:max-[1439px]:col-span-2" locale={locale} dictionary={dictionary} />
      <RecentOrders locale={locale} dictionary={dictionary} />
      <PaymentCalendar locale={locale} dictionary={dictionary} />
    </div>
  );
}
