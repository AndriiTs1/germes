import { SidebarContent } from "@/components/dashboard/sidebar-content";

/**
 * Permanent desktop navigation rail. Hidden below the `xl` breakpoint, where
 * `MobileNav` provides the same navigation hierarchy inside a drawer instead.
 */
export function DashboardSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200/70 bg-white xl:flex">
      <SidebarContent />
    </aside>
  );
}
