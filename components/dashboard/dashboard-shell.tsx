import type { ReactNode } from "react";

import { DashboardHeader } from "@/components/dashboard/header";
import { DashboardSidebar } from "@/components/dashboard/sidebar";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-[#F7F8FA]">
      <DashboardSidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardHeader />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1400px] px-4 pt-6 pb-6 sm:px-6 sm:pb-8 sm:max-[1439px]:pt-8 xl:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
