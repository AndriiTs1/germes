import type { ReactNode } from "react";

import { DashboardHeader } from "@/components/dashboard/header";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { buildUserDisplay, type ShellUser } from "@/components/dashboard/user-display";

type DashboardShellProps = {
  user: ShellUser;
  permissionCodes: string[];
  children: ReactNode;
};

/**
 * Pure shell: takes already-fetched user/permission data as props rather
 * than fetching itself, so it stays a plain, reusable layout component
 * with no auth/permission imports of its own. Every page that renders it
 * (currently only "/") is responsible for its own requireUser()/permission
 * check before rendering this.
 */
export function DashboardShell({ user, permissionCodes, children }: DashboardShellProps) {
  const userDisplay = buildUserDisplay(user);

  return (
    <div className="flex min-h-screen w-full bg-[#F7F8FA]">
      <DashboardSidebar permissionCodes={permissionCodes} userDisplay={userDisplay} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardHeader permissionCodes={permissionCodes} userDisplay={userDisplay} />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1400px] px-4 pt-6 pb-6 sm:px-6 sm:pb-8 sm:max-[1439px]:pt-8 xl:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
