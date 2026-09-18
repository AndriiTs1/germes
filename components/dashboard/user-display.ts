export type ShellUser = {
  name: string | null;
  email: string;
};

export type UserDisplay = {
  name: string;
  secondaryLabel: string;
  initials: string;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Derives display-only fields from real User data. Never surfaces role
 * names — secondary label is the email (or a neutral fallback), not a
 * job title, so this stays a display concern, not an authorization one.
 *
 * fallbackLabel is the caller-supplied, already-localized string used only
 * when user.name is null — this file never reads locale/cookies/
 * dictionaries itself, matching every other presentation-only component.
 */
export function buildUserDisplay(user: ShellUser, fallbackLabel: string): UserDisplay {
  const trimmedName = user.name?.trim();

  if (trimmedName) {
    return {
      name: trimmedName,
      secondaryLabel: user.email,
      initials: initialsFromName(trimmedName),
    };
  }

  return {
    name: user.email,
    secondaryLabel: fallbackLabel,
    initials: user.email.slice(0, 2).toUpperCase(),
  };
}
