import { OperationsCard } from "@/components/dashboard/operations/operations-card";
import { paymentCalendar } from "@/components/dashboard/operations/operations-data";
import type { PaymentStatus } from "@/components/dashboard/operations/operations-data";
import { INTL_LOCALE_MAP, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

const statusTextStyles: Record<PaymentStatus, string> = {
  overdue: "text-rose-600",
  positive: "text-emerald-600",
  neutral: "text-slate-400",
  upcoming: "text-slate-400",
};

const amountStyles: Record<PaymentStatus, string> = {
  overdue: "text-rose-600",
  positive: "text-emerald-600",
  neutral: "text-slate-900",
  upcoming: "text-slate-900",
};

export function PaymentCalendar({
  className,
  locale,
  dictionary,
}: {
  className?: string;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const t = dictionary.commandCenter.paymentCalendar;
  const monthFormatter = new Intl.DateTimeFormat(INTL_LOCALE_MAP[locale], { month: "short" });

  return (
    <OperationsCard
      title={t.title}
      className={className}
      action={
        <button
          type="button"
          className="text-[12px] font-medium text-slate-400 transition-colors hover:text-slate-700"
        >
          {dictionary.common.viewAll}
        </button>
      }
    >
      <ul className="flex flex-1 flex-col justify-between">
        {paymentCalendar.map((item, index) => {
          const monthLabel = monthFormatter.format(new Date(Date.UTC(2000, item.monthIndex, 1)));
          const eventLabel = t.events[item.eventType];
          const statusLabel = t.status[item.status];

          return (
            <li key={`${item.day}-${item.monthIndex}-${index}`}>
              {/* >=380px: unchanged single-row layout */}
              <div className="hidden items-center gap-3 rounded-xl px-2 py-0.5 transition-colors hover:bg-slate-50 min-[380px]:flex">
                <div className="flex w-9 shrink-0 flex-col items-center rounded-lg bg-slate-50 py-0.5">
                  <span className="text-[9px] font-medium tracking-wide text-slate-400 uppercase">
                    {monthLabel}
                  </span>
                  <span className="text-[13px] leading-tight font-semibold text-slate-700">{item.day}</span>
                </div>
                <div className="min-w-0 flex-1">
                  {/* line-clamp-2 (not truncate): the event label was being cut even where the row had room to wrap — this container already had min-w-0 flex-1. */}
                  <p className="line-clamp-2 text-[12.5px] leading-tight font-medium text-slate-900">
                    {eventLabel}
                  </p>
                  <p className={cn("text-[11px] leading-tight font-medium", statusTextStyles[item.status])}>
                    {statusLabel}
                  </p>
                </div>
                <span className={cn("shrink-0 text-[12.5px] font-semibold", amountStyles[item.status])}>
                  {item.amount}
                </span>
              </div>

              {/* <380px: title/status keep the date badge's row, amount moves to its own right-aligned line */}
              <div className="flex flex-col gap-0.5 rounded-xl px-2 py-1 transition-colors hover:bg-slate-50 min-[380px]:hidden">
                <div className="flex items-start gap-3">
                  <div className="flex w-9 shrink-0 flex-col items-center rounded-lg bg-slate-50 py-0.5">
                    <span className="text-[9px] font-medium tracking-wide text-slate-400 uppercase">
                      {monthLabel}
                    </span>
                    <span className="text-[13px] leading-tight font-semibold text-slate-700">
                      {item.day}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[12.5px] leading-tight font-medium text-slate-900">
                      {eventLabel}
                    </p>
                    <p
                      className={cn(
                        "text-[11px] leading-tight font-medium",
                        statusTextStyles[item.status],
                      )}
                    >
                      {statusLabel}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end pl-12">
                  <span className={cn("text-[12.5px] font-semibold", amountStyles[item.status])}>
                    {item.amount}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </OperationsCard>
  );
}
