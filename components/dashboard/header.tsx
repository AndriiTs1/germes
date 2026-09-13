import { Bell, Search } from "lucide-react";

import { MobileNav } from "@/components/dashboard/mobile-nav";
import { PeriodControl } from "@/components/dashboard/period-control";
import type { UserDisplay } from "@/components/dashboard/user-display";

type DashboardHeaderProps = {
  permissionCodes: string[];
  userDisplay: UserDisplay;
  activePath: string;
  /** Defaults to true — preserves the Owner Command Center header exactly. */
  showPeriodControl?: boolean;
};

export function DashboardHeader({
  permissionCodes,
  userDisplay,
  activePath,
  showPeriodControl = true,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b border-slate-200/70 bg-white/90 px-4 backdrop-blur-md sm:gap-3 sm:px-6 xl:gap-4 xl:px-8">
      <MobileNav permissionCodes={permissionCodes} userDisplay={userDisplay} activePath={activePath} />

      <div className="flex shrink-0 items-center gap-2 xl:hidden">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-slate-900 text-[12px] font-semibold text-white">
          G
        </div>
        <span className="hidden text-[14px] font-semibold tracking-tight text-slate-900 min-[360px]:inline">
          Germes
        </span>
      </div>

      {/*
        Tablet / compact desktop: same field, shorter placeholder — a native
        <input> placeholder can't respond to a media query, so this is a
        second element gated by the same named breakpoints (md/xl) already
        driving the width change, rather than truncating text that doesn't
        fit.
      */}
      <div className="relative hidden min-w-0 flex-1 md:block md:max-w-[220px] xl:hidden">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
          strokeWidth={1.75}
        />
        <input
          type="text"
          placeholder="Search..."
          // text-base md:text-[13px] (not a fixed text-[13px]): a real
          // text-entry control, visible from md up on touch-capable
          // devices (tablet/compact desktop) — iOS Safari auto-zooms the
          // visual viewport when a focused input's computed font-size is
          // below 16px.
          className="h-9 w-full rounded-full border border-slate-200/70 bg-slate-100/70 pr-3 pl-10 text-base text-slate-700 placeholder:text-slate-400 transition-colors focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:outline-none md:text-[13px]"
        />
      </div>

      {/* Large desktop: full search field with the original placeholder, unchanged. */}
      <div className="relative hidden min-w-0 flex-1 xl:block xl:max-w-[420px]">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
          strokeWidth={1.75}
        />
        <input
          type="text"
          placeholder="Search customers, orders, products..."
          // text-base md:text-[13px] — same iOS Safari auto-zoom
          // prevention as the compact variant above.
          className="h-9 w-full rounded-full border border-slate-200/70 bg-slate-100/70 pr-3 pl-10 text-base text-slate-700 placeholder:text-slate-400 transition-colors focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:outline-none md:text-[13px]"
        />
      </div>

      {/* Mobile: icon-only search trigger to avoid cramming a full field into the header */}
      <button
        type="button"
        aria-label="Search"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 md:hidden"
      >
        <Search className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        {showPeriodControl ? <PeriodControl className="hidden md:flex" /> : null}

        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100"
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-blue-500 ring-2 ring-white" />
        </button>

        <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />

        <div
          title={userDisplay.name}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-medium text-white ring-2 ring-white"
        >
          {userDisplay.initials}
        </div>
      </div>
    </header>
  );
}
