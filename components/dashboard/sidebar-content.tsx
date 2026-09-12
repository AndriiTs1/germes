import Link from "next/link";
import {
  Boxes,
  ChevronsUpDown,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Settings,
  ShoppingCart,
  Truck,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      { label: "Command Center", href: "#", icon: LayoutDashboard, active: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Sales", href: "#", icon: ShoppingCart },
      { label: "Procurement", href: "#", icon: ClipboardList },
      { label: "Inventory", href: "#", icon: Boxes },
      { label: "Finance", href: "#", icon: Wallet },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Customers", href: "#", icon: Users },
      { label: "Suppliers", href: "#", icon: Truck },
      { label: "Team", href: "#", icon: UserRound },
      { label: "Documents", href: "#", icon: FileText },
    ],
  },
];

/**
 * Full navigation hierarchy shared by the permanent desktop sidebar and the
 * mobile/tablet drawer, so both stay in sync from a single source of truth.
 */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-2.5">
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
        {navSections.map((section, index) => (
          <div key={section.label} className={cn(index > 0 && "mt-6")}>
            <p className="mb-2 px-3 text-[10.5px] font-medium tracking-[0.08em] text-slate-400 uppercase">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={item.active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-[7px] text-[13.5px] font-medium transition-colors duration-150",
                      item.active
                        ? "bg-blue-50 text-blue-600"
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
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-slate-200/70 px-3 py-3">
        <Link
          href="#"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-xl px-3 py-[7px] text-[13.5px] font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100/80 hover:text-slate-900"
        >
          <Settings className="h-[17px] w-[17px] shrink-0 text-slate-400" strokeWidth={1.6} />
          Settings
        </Link>

        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-2xl border border-slate-200/70 bg-slate-50 px-2.5 py-2 text-left shadow-sm transition-colors hover:bg-slate-100/60"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-medium text-white">
            AN
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-slate-900">Account</p>
            <p className="truncate text-[11px] text-slate-400">Owner</p>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} />
        </button>
      </div>
    </>
  );
}
