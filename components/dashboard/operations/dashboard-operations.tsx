import { NeedsAttention } from "@/components/dashboard/operations/needs-attention";
import { PaymentCalendar } from "@/components/dashboard/operations/payment-calendar";
import { RecentOrders } from "@/components/dashboard/operations/recent-orders";

export function DashboardOperations() {
  return (
    <div className="grid grid-cols-1 gap-4 min-[768px]:max-[1439px]:grid-cols-2 min-[1440px]:grid-cols-[1.35fr_1fr_1fr]">
      <NeedsAttention className="min-[768px]:max-[1439px]:col-span-2" />
      <RecentOrders />
      <PaymentCalendar />
    </div>
  );
}
