import { LayoutDashboard, ShoppingCart, type LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  requiredPermission: string;
  icon: LucideIcon;
  /** Computed by filterNavSections from the current activePath — never set here. */
  active?: boolean;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

/**
 * Single source of truth for desktop and mobile navigation.
 *
 * Only routes that exist today are listed here. Procurement/Inventory/
 * Finance/Customers/Suppliers/Team/Documents/Settings are intentionally
 * omitted rather than linked with a placeholder href — those workspaces
 * don't have real pages yet. Adding one later is a one-line addition: a
 * real href plus its exact Permission.code.
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
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      {
        label: "Sales",
        href: "/sales",
        requiredPermission: "sales.orders.read",
        icon: ShoppingCart,
      },
    ],
  },
];

/**
 * "/" matches only "/"; any other item matches its own path or a future
 * descendant path (e.g. "/sales" would also match "/sales/orders" once
 * that route exists) — no router abstraction, just a plain prefix check.
 */
function isNavItemActive(href: string, activePath: string): boolean {
  if (href === "/") return activePath === "/";
  return activePath === href || activePath.startsWith(`${href}/`);
}

/**
 * Keeps only items the given live permission codes actually unlock,
 * computes each surviving item's active state from activePath, and drops
 * any section left with zero items. No role.code is consulted here.
 */
export function filterNavSections(
  sections: NavSection[],
  permissionCodes: string[],
  activePath: string,
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => permissionCodes.includes(item.requiredPermission))
        .map((item) => ({ ...item, active: isNavItemActive(item.href, activePath) })),
    }))
    .filter((section) => section.items.length > 0);
}
