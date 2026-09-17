import type { Dictionary } from "@/lib/i18n/get-dictionary";

/**
 * Shown at "/" for an authenticated, active user who has no permission
 * that unlocks a landing workspace yet (e.g. a SALES-only user before
 * Stage 8D adds /sales). Intentionally plain — no fake KPI data, no
 * placeholder workspace content.
 *
 * No Sign out control here: this always renders inside DashboardShell,
 * whose nav includes Settings unconditionally for every authenticated
 * user (no requiredPermission gate — see nav-items.ts), so Settings ->
 * Sign out remains reachable even with zero workspace permissions.
 */
export function NoWorkspaceAvailable({ dictionary }: { dictionary: Dictionary }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-[18px] font-semibold tracking-tight text-slate-900">
        {dictionary.noWorkspace.title}
      </h1>
      <p className="mt-2 max-w-sm text-[13.5px] text-slate-500">
        {dictionary.noWorkspace.description}
      </p>
    </div>
  );
}
