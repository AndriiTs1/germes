"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";

import { SidebarContent } from "@/components/dashboard/sidebar-content";

/**
 * Menu trigger + drawer used below the `xl` breakpoint, where the permanent
 * `DashboardSidebar` is hidden. Renders the same `SidebarContent` so nav
 * hierarchy never drifts between desktop and mobile/tablet.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogTitleId = useId();

  useEffect(() => {
    if (!open) return;

    const triggerElement = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      triggerElement?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 xl:hidden"
      >
        <Menu className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-50 xl:hidden">
              <button
                type="button"
                aria-label="Close navigation"
                className="animate-in fade-in absolute inset-0 h-full w-full cursor-default bg-slate-900/30 duration-150"
                onClick={() => setOpen(false)}
              />

              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={dialogTitleId}
                className="animate-in slide-in-from-left absolute inset-y-0 left-0 flex h-full w-[280px] max-w-[85vw] flex-col bg-white shadow-2xl duration-200 ease-out"
              >
                <span id={dialogTitleId} className="sr-only">
                  Navigation
                </span>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close navigation"
                  className="absolute top-5 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>

                <SidebarContent onNavigate={() => setOpen(false)} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
