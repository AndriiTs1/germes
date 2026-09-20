import Link from "next/link";
import { ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { filterNavSections, navSections } from "@/components/dashboard/nav-items";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { UserDisplay } from "@/components/dashboard/user-display";
import type { NavigationProfile } from "@/components/dashboard/navigation-profile";

type SidebarContentProps = {
  permissionCodes: string[];
  userDisplay: UserDisplay;
  activePath: string;
  dictionary: Dictionary;
  navigationProfile: NavigationProfile;
  onNavigate?: () => void;
};

/**
 * Full navigation hierarchy shared by the permanent desktop sidebar and the
 * mobile/tablet drawer, so both stay in sync from a single source of truth.
 *
 * Stays a plain, unmarked component (no "use client", no server-only calls)
 * so it can keep being imported directly by the Client Component MobileNav,
 * exactly as it can be today. All auth/permission data arrives as plain
 * props, already computed server-side by the page + DashboardShell.
 *
 * dictionary resolves each item/section's display label (labelKey ->
 * dictionary.nav[...]) — filterNavSections itself stays entirely
 * locale-agnostic (see nav-items.ts); only the rendered text varies here.
 */
export function SidebarContent({
  permissionCodes,
  userDisplay,
  activePath,
  dictionary,
  navigationProfile,
  onNavigate,
}: SidebarContentProps) {
  const visibleSections = filterNavSections(
    navSections,
    permissionCodes,
    activePath,
    navigationProfile,
  );

  return (
    <>
      <div className="px-5 pt-6 pb-5 xl:pt-7 xl:pb-6">
        <div className="flex items-center gap-2.5 xl:gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-[13px] font-semibold text-white">
            G
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-slate-900">
            Germes
          </span>
        </div>
        <p className="mt-1 pl-[42px] text-[11px] tracking-wide text-slate-400">
          Trade. People. Growth.
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {visibleSections.map((section, index) => (
          <div key={section.labelKey} className={cn(index > 0 && "mt-6 xl:mt-7")}>
            <p className="mb-2 px-3 text-[10.5px] font-medium tracking-[0.08em] text-slate-400 uppercase">
              {dictionary.nav.sections[section.labelKey]}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.labelKey}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={item.active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-[7px] text-[13.5px] font-medium transition-colors duration-150",
                      item.active
                        ? "bg-blue-50 text-blue-600 xl:font-semibold xl:ring-1 xl:ring-inset xl:ring-blue-600/10"
                        : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-[17px] w-[17px] shrink-0",
                        item.active ? "text-blue-600" : "text-slate-400",
                      )}
                      strokeWidth={1.6}
                    />
                    {dictionary.nav[item.labelKey]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-slate-200/70 px-3 py-3">
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-2xl border border-slate-200/70 bg-slate-50 px-2.5 py-2 text-left shadow-sm transition-colors hover:bg-slate-100/60 xl:border-slate-200 xl:bg-white xl:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-4px_rgba(15,23,42,0.08)] xl:hover:bg-slate-50"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-medium text-white">
            {userDisplay.initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-slate-900 xl:leading-[1.3]">
              {userDisplay.name}
            </p>
            <p className="truncate text-[11px] text-slate-400 xl:leading-[1.3]">
              {userDisplay.secondaryLabel}
            </p>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} />
        </button>
      </div>
    </>
  );
}
