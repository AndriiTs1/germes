import { logout } from "@/lib/auth/actions";

/**
 * Shown at "/" for an authenticated, active user who has no permission
 * that unlocks a landing workspace yet (e.g. a SALES-only user before
 * Stage 8D adds /sales). Intentionally plain — no fake KPI data, no
 * placeholder workspace content.
 */
export function NoWorkspaceAvailable() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-[18px] font-semibold tracking-tight text-slate-900">
        No workspace available yet
      </h1>
      <p className="mt-2 max-w-sm text-[13.5px] text-slate-500">
        Your account doesn&apos;t have access to a workspace yet. Contact your
        administrator if you believe this is a mistake.
      </p>

      <form action={logout} className="mt-5">
        <button
          type="submit"
          className="text-[13px] font-medium text-slate-500 hover:text-slate-700"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
