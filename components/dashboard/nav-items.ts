import { ClipboardList, LayoutDashboard, ShoppingCart, type LucideIcon } from "lucide-react";

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
 * Only routes that exist today are listed here. Customers/Reservations/
 * Receivables/Stock/Procurement/Inventory/Finance/Suppliers/Team/Documents/
 * Settings are intentionally omitted rather than linked with a placeholder
 * href — those pages don't exist yet. Adding one later is a one-line
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
  {
    label: "Sell",
    items: [
      {
        label: "Orders",
        href: "/sales/orders",
        requiredPermission: "sales.orders.read",
        icon: ClipboardList,
      },
    ],
  },
];

/**
 * Exact match only. Sidebar items are a flat list of siblings, not a
 * nested tree — "Sales" and "Orders" are two separate top-level entries
 * that happen to share a path prefix, not parent/child, so "/sales/orders"
 * must activate "Orders" alone, never also "Sales".
 */
function isNavItemActive(href: string, activePath: string): boolean {
  return activePath === href;
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
