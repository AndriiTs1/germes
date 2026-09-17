import type { Dictionary } from "@/lib/i18n/dictionaries/en";

/**
 * Language names are autonyms (each language names itself, in its own
 * script) rather than translations — "English"/"Українська"/"Русский" stay
 * the same regardless of which dictionary is active, exactly like every
 * real-world language picker.
 */
export const ru: Dictionary = {
  settings: {
    title: "Настройки",
    subtitle: "Управляйте личными настройками и учётной записью Germes.",
    general: {
      title: "Общие",
      language: "Язык",
    },
    languages: {
      en: "English",
      uk: "Українська",
      ru: "Русский",
    },
    language: {
      current: "Текущий",
    },
    more: {
      title: "Дополнительные настройки",
      profile: "Профиль",
      notifications: "Уведомления",
      security: "Безопасность",
    },
    comingSoon: "Скоро",
    account: {
      title: "Аккаунт",
      signOutDescription: "Выйти из аккаунта Germes на этом устройстве.",
      signOut: "Выйти",
    },
  },
};
