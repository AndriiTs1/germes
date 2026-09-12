import { OperationsCard } from "@/components/dashboard/operations/operations-card";
import { recentOrders } from "@/components/dashboard/operations/operations-data";
import { cn } from "@/lib/utils";

export function RecentOrders({ className }: { className?: string }) {
  return (
    <OperationsCard
      title="Recent Orders"
      className={className}
      action={
        <button
          type="button"
          className="text-[12px] font-medium text-slate-400 transition-colors hover:text-slate-700"
        >
          View all
        </button>
      }
    >
      <ul className="flex flex-1 flex-col justify-between">
        {recentOrders.map((order) => (
          <li key={order.id}>
            {/* >=380px: unchanged single-row layout */}
            <div className="hidden items-center gap-3 rounded-xl px-2 py-0.5 transition-colors hover:bg-slate-50 min-[380px]:flex">
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  order.isToday ? "bg-blue-500" : "bg-slate-300",
                )}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5 leading-tight">
                  <span className="shrink-0 text-[11.5px] font-medium text-slate-400">{order.id}</span>
                  <span className="truncate text-[12.5px] font-medium text-slate-900">
                    {order.customer}
                  </span>
                </div>
                <p className="text-[11px] leading-tight text-slate-400">{order.timestamp}</p>
              </div>
              <span className="shrink-0 text-[12.5px] font-semibold text-slate-900">{order.amount}</span>
            </div>

            {/* <380px: two-line layout so the customer name gets full row width instead of ellipsizing */}
            <div className="flex flex-col gap-0.5 rounded-xl px-2 py-1 transition-colors hover:bg-slate-50 min-[380px]:hidden">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    order.isToday ? "bg-blue-500" : "bg-slate-300",
                  )}
                  aria-hidden="true"
                />
                <span className="shrink-0 text-[11.5px] font-medium text-slate-400">{order.id}</span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-slate-900">
                  {order.customer}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] leading-tight text-slate-400">{order.timestamp}</span>
                <span className="shrink-0 text-[12.5px] font-semibold text-slate-900">{order.amount}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </OperationsCard>
  );
}
