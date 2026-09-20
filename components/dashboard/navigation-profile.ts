import type { ShellUser } from "@/components/dashboard/user-display";

export type NavigationProfile = "owner" | "admin" | "default";

export function getNavigationProfile(
  user: ShellUser,
): NavigationProfile {
  const roleCodes = new Set(
    user.roles.map((entry) => entry.role.code),
  );

  if (roleCodes.has("OWNER")) {
    return "owner";
  }

  if (roleCodes.has("ADMIN")) {
    return "admin";
  }

  return "default";
}
