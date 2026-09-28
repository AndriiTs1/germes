"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Supervisory /sales only: the operational cards (already rendered on the
 * server) stay collapsed until the owner asks for them. Only the open/closed
 * flag lives on the client — opening never fetches anything.
 */
export function OperationalDetails({
  title,
  showLabel,
  hideLabel,
  children,
}: {
  title: string;
  showLabel: string;
  hideLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <section className="flex flex-col gap-3 xl:gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-1 text-[12.5px] font-medium text-blue-600 hover:text-blue-700"
        >
          {open ? hideLabel : showLabel}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} strokeWidth={2} />
        </button>
      </div>
      <div id={contentId} className="flex flex-col gap-4 xl:gap-3.5">
        {open ? children : null}
      </div>
    </section>
  );
}
