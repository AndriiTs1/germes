import { LayoutDashboard, type LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  requiredPermission: string;
  icon: LucideIcon;
  active?: boolean;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

/**
 * Single source of truth for desktop and mobile navigation.
 *
 * Only routes that exist today are listed here. Sales/Procurement/Inventory/
 * Finance/Customers/Suppliers/Team/Documents/Settings are intentionally
 * omitted rather than linked with a placeholder href — those workspaces
 * don't have real pages yet (Stage 8D+). Adding one later is a one-line
 * addition: a real href plus its exact Permission.code.
 */
export const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      {
        label: "Command Center",
        href: "/",
        requiredPermission: "dashboard.command_center.read",
        icon: LayoutDashboard,
        active: true,
      },
    ],
  },
];

/**
 * Keeps only items the given live permission codes actually unlock, and
 * drops any section left with zero items. No role.code is consulted here.
 */
export function filterNavSections(
  sections: NavSection[],
  permissionCodes: string[],
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        permissionCodes.includes(item.requiredPermission),
      ),
    }))
    .filter((section) => section.items.length > 0);
}
