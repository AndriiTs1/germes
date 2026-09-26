import { X } from "lucide-react";
import Link from "next/link";

/**
 * "Manager: <name> ✕" above a supervisory customers/orders list filtered by
 * ?manager=. The ✕ is a plain link to the same URL without manager; the
 * optional second link jumps to the same manager's other list (customers ↔
 * orders). Server-rendered, no client state.
 */
export function ManagerFilterChip({
  managerName,
  clearHref,
  otherListHref,
  labels,
}: {
  managerName: string;
  clearHref: string;
  otherListHref?: string;
  labels: { prefix: string; clear: string; otherList?: string };
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 py-1 pr-1 pl-3 text-[12.5px] font-medium text-blue-700">
        {labels.prefix}: {managerName}
        <Link
          href={clearHref}
          aria-label={labels.clear}
          title={labels.clear}
          className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </span>
      {otherListHref && labels.otherList ? (
        <Link
          href={otherListHref}
          className="text-[12.5px] font-medium text-blue-600 hover:text-blue-700"
        >
          {labels.otherList} →
        </Link>
      ) : null}
    </div>
  );
}
