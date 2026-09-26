export type SalesReadScope = "own" | "all";

export function resolveSalesReadScope(
  roleCodes: string[],
): SalesReadScope {
  return roleCodes.includes("OWNER") ? "all" : "own";
}

/**
 * The ONLY place that turns (read scope, caller, optional manager filter)
 * into a Customer/SalesOrder responsibleId condition. Every service that
 * accepts a managerId must derive its responsibleId from this — never read
 * managerId directly — so a SALES user can never widen or redirect their
 * own visibility by editing ?manager= in the URL.
 *
 *   "own" → always currentUserId; managerId is IGNORED, whatever it is.
 *   "all" → managerId narrows to that one manager; undefined/empty = everyone.
 *
 * managerId is not validated here: an unknown id simply matches no rows.
 */
export function resolveResponsibleFilter(
  scope: SalesReadScope,
  currentUserId: string,
  managerId?: string,
): string | undefined {
  if (scope !== "all") return currentUserId;
  return managerId ? managerId : undefined;
}
