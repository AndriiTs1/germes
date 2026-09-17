/**
 * Canonical English dictionary — this object's inferred shape (via `typeof`,
 * deliberately without `as const`, so every leaf widens to `string`) IS the
 * Dictionary type every other locale must satisfy. Add a key here first;
 * uk.ts/ru.ts then fail to compile until they provide it too.
 *
 * Namespaced by UI area, not by literal English wording, so a key never
 * needs to change just because its English copy does. Only the Settings
 * surface is populated in this stage (L1/L2) — later stages add their own
 * top-level namespaces (nav, sales, orders, ...) the same way.
 */
export const en = {
  settings: {
    title: "Settings",
    subtitle: "Manage your personal Germes preferences and account.",
    general: {
      title: "General",
      language: "Language",
    },
    languages: {
      en: "English",
      uk: "Українська",
      ru: "Русский",
    },
    language: {
      current: "Current",
    },
    more: {
      title: "More settings",
      profile: "Profile",
      notifications: "Notifications",
      security: "Security",
    },
    comingSoon: "Coming soon",
    account: {
      title: "Account",
      signOutDescription: "Sign out of your Germes account on this device.",
      signOut: "Sign out",
    },
  },
};

export type Dictionary = typeof en;
