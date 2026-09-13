import { SidebarContent } from "@/components/dashboard/sidebar-content";
import type { UserDisplay } from "@/components/dashboard/user-display";

type DashboardSidebarProps = {
  permissionCodes: string[];
  userDisplay: UserDisplay;
};

/**
 * Permanent desktop navigation rail. Hidden below the `xl` breakpoint, where
 * `MobileNav` provides the same navigation hierarchy inside a drawer instead.
 */
export function DashboardSidebar({ permissionCodes, userDisplay }: DashboardSidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200/70 bg-white xl:flex">
      <SidebarContent permissionCodes={permissionCodes} userDisplay={userDisplay} />
    </aside>
  );
}
