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
 * An item "matches" activePath if activePath equals its href or is a
 * descendant of it (activePath.startsWith(href + "/")). Among all matching
 * items across the whole (permission-filtered) list, only the one with
 * the longest href is active — so a more specific route ("/sales/orders")
 * wins over a shorter ancestor ("/sales") without any route-name-specific
 * logic. Generic: it works the same way for any future nested route
 * (e.g. "/sales/orders/[id]" naturally activates "/sales/orders" alone).
 */
function computeActiveHref(sections: NavSection[], activePath: string): string | null {
  let best: string | null = null;

  for (const section of sections) {
    for (const item of section.items) {
      const matches = activePath === item.href || activePath.startsWith(`${item.href}/`);
      if (matches && (best === null || item.href.length > best.length)) {
        best = item.href;
      }
    }
  }

  return best;
}

/**
 * Keeps only items the given live permission codes actually unlock,
 * computes the single longest-matching item's active state from
 * activePath, and drops any section left with zero items. No role.code
 * is consulted here.
 */
export function filterNavSections(
  sections: NavSection[],
  permissionCodes: string[],
  activePath: string,
): NavSection[] {
  const permitted = sections.map((section) => ({
    ...section,
    items: section.items.filter((item) => permissionCodes.includes(item.requiredPermission)),
  }));

  const activeHref = computeActiveHref(permitted, activePath);

  return permitted
    .map((section) => ({
      ...section,
      items: section.items.map((item) => ({ ...item, active: item.href === activeHref })),
    }))
    .filter((section) => section.items.length > 0);
}
