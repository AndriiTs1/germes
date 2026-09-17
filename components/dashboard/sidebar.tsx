import { SidebarContent } from "@/components/dashboard/sidebar-content";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { UserDisplay } from "@/components/dashboard/user-display";

type DashboardSidebarProps = {
  permissionCodes: string[];
  userDisplay: UserDisplay;
  activePath: string;
  dictionary: Dictionary;
};

/**
 * Permanent desktop navigation rail. Hidden below the `xl` breakpoint, where
 * `MobileNav` provides the same navigation hierarchy inside a drawer instead.
 */
export function DashboardSidebar({
  permissionCodes,
  userDisplay,
  activePath,
  dictionary,
}: DashboardSidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200/70 bg-white xl:flex">
      <SidebarContent
        permissionCodes={permissionCodes}
        userDisplay={userDisplay}
        activePath={activePath}
        dictionary={dictionary}
      />
    </aside>
  );
}
