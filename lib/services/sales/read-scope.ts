export type SalesReadScope = "own" | "all";

export function resolveSalesReadScope(
  roleCodes: string[],
): SalesReadScope {
  return roleCodes.includes("OWNER") ? "all" : "own";
}
