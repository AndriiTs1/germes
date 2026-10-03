import {
  Building2,
  ClipboardList,
  Landmark,
  LifeBuoy,
  LayoutDashboard,
  Package,
  ShieldCheck,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import type { NavigationProfile } from "@/components/dashboard/navigation-profile";

/** Keys into dictionary.nav — the item's display label, resolved per current locale. Never itself an English string. */
export type NavItemKey =
  | "commandCenter"
  | "sales"
  | "procurement"
  | "warehouse"
  | "finance"
  | "administration"
  | "support"
  | "orders"
  | "customers"
  | "purchaseOrders"
  | "suppliers"
  | "products"
  | "settings";

/** Keys into dictionary.nav.sections — the group heading, resolved per current locale. */
export type NavSectionKey = "overview" | "workspace" | "sell" | "buy" | "catalog" | "account";

export type NavItem = {
  labelKey: NavItemKey;
  href: string;
  /**
   * Omitted means "visible to every authenticated user" — not a fake
   * always-true permission code, just the absence of a gate. Used for
   * personal routes (e.g. Settings) that aren't workspace/data access
   * concerns. Every other item keeps requiring its exact Permission.code.
   */
  requiredPermission?: string;
  /**
   * For a route gated on more than one permission: EVERY code listed here
   * must be present (in addition to requiredPermission, if also set), so
   * the item is only shown when the page would actually let the user in.
   */
  requiredPermissions?: string[];
  icon: LucideIcon;
  /** Computed by filterNavSections from the current activePath — never set here. */
  active?: boolean;
};

export type NavSection = {
  labelKey: NavSectionKey;
  items: NavItem[];
};

/**
 * Single source of truth for desktop and mobile navigation, and for which
 * items exist and which permission unlocks each one. Display text is never
 * hardcoded here — labelKey only selects a key in the current dictionary
 * (see lib/i18n/dictionaries/en.ts's `nav` namespace), resolved by
 * SidebarContent. Permission gating (requiredPermission) and route
 * structure are completely independent of locale — changing language never
 * changes which items exist or who sees them.
 *
 * Only routes that exist today are listed here. Reservations/Receivables/
 * Stock/Inventory/Team/Documents are
 * intentionally omitted rather than linked with a placeholder href — those
 * pages don't exist yet. Adding one later is a one-line addition: a real
 * href plus its exact Permission.code plus a new nav dictionary key.
 */
export const navSections: NavSection[] = [
  {
    labelKey: "overview",
    items: [
      {
        labelKey: "commandCenter",
        href: "/",
        requiredPermission: "dashboard.command_center.read",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    labelKey: "workspace",
    items: [
      {
        labelKey: "sales",
        href: "/sales",
        requiredPermission: "workspace.sales.access",
        icon: ShoppingCart,
      },
      {
        labelKey: "procurement",
        href: "/procurement",
        requiredPermission: "procurement.overview.read",
        icon: Truck,
      },
      {
        labelKey: "warehouse",
        href: "/warehouse",
        requiredPermission: "workspace.warehouse.access",
        icon: Warehouse,
      },
      {
        labelKey: "finance",
        href: "/finance",
        requiredPermission: "finance.dashboard.read",
        icon: Landmark,
      },
      {
        labelKey: "administration",
        href: "/admin",
        requiredPermission: "workspace.admin.access",
        icon: ShieldCheck,
      },
      {
        labelKey: "support",
        href: "/support",
        requiredPermission: "support.workspace.access",
        icon: LifeBuoy,
      },
    ],
  },
  {
    labelKey: "sell",
    items: [
      {
        labelKey: "orders",
        href: "/sales/orders",
        requiredPermission: "workspace.sales.access",
        icon: ClipboardList,
      },
      {
        labelKey: "customers",
        href: "/sales/customers",
        requiredPermission: "workspace.sales.access",
        icon: Users,
      },
    ],
  },
  {
    // Same pattern as "sell": the workspace "procurement" item (/procurement)
    // is the Procurement overview entry; this section holds its sub-pages.
    labelKey: "buy",
    items: [
      {
        labelKey: "purchaseOrders",
        href: "/procurement/orders",
        requiredPermission: "procurement.orders.read",
        icon: ClipboardList,
      },
      {
        labelKey: "suppliers",
        href: "/procurement/suppliers",
        // Mirrors the page gate: /procurement/suppliers requires both.
        requiredPermissions: ["procurement.overview.read", "suppliers.read"],
        icon: Building2,
      },
    ],
  },
  {
    // Shared master data ("Довідники"), deliberately not under sell/buy or a
    // single workspace: one Product is used by Sales, Procurement, Warehouse,
    // supplier agreements and orders alike.
    labelKey: "catalog",
    items: [
      {
        labelKey: "products",
        href: "/products",
        requiredPermission: "products.read",
        icon: Package,
      },
    ],
  },
  {
    labelKey: "account",
    items: [
      {
        labelKey: "settings",
        href: "/settings",
        // No requiredPermission: personal settings (incl. sign out) must
        // stay reachable for every authenticated user, regardless of which
        // workspace permissions they hold.
        icon: Settings,
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
 * Keeps only items the given live permission codes actually unlock, plus
 * any item with no requiredPermission (visible to every authenticated
 * user — e.g. personal Settings), computes the single longest-matching
 * item's active state from activePath, and drops any section left with
 * zero items. No role.code is consulted here, and nothing here depends on
 * locale — the same items appear for the same user regardless of which
 * language they've chosen; only their rendered label text differs.
 */
export function filterNavSections(
  sections: NavSection[],
  permissionCodes: string[],
  activePath: string,
  profile: NavigationProfile = "default",
): NavSection[] {
  const profileFiltered =
    profile === "admin"
      ? sections
          .map((section) => ({
            ...section,
            items: section.items.filter(
              (item) =>
                item.labelKey === "administration" ||
                item.labelKey === "settings",
            ),
          }))
          .filter((section) => section.items.length > 0)
      : sections;

  const permitted = profileFiltered.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        (!item.requiredPermission || permissionCodes.includes(item.requiredPermission)) &&
        (!item.requiredPermissions ||
          item.requiredPermissions.every((code) => permissionCodes.includes(code))),
    ),
  }));

  const activeHref = computeActiveHref(permitted, activePath);

  return permitted
    .map((section) => ({
      ...section,
      items: section.items.map((item) => ({ ...item, active: item.href === activeHref })),
    }))
    .filter((section) => section.items.length > 0);
}
