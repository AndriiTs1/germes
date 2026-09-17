import type { Dictionary } from "@/lib/i18n/dictionaries/en";

/**
 * Language names are autonyms (each language names itself, in its own
 * script) rather than translations — "English"/"Українська"/"Русский" stay
 * the same regardless of which dictionary is active, exactly like every
 * real-world language picker.
 */
export const uk: Dictionary = {
  settings: {
    title: "Налаштування",
    subtitle: "Керуйте особистими налаштуваннями та обліковим записом Germes.",
    general: {
      title: "Загальні",
      language: "Мова",
    },
    languages: {
      en: "English",
      uk: "Українська",
      ru: "Русский",
    },
    language: {
      current: "Поточна",
    },
    more: {
      title: "Додаткові налаштування",
      profile: "Профіль",
      notifications: "Сповіщення",
      security: "Безпека",
    },
    comingSoon: "Незабаром",
    account: {
      title: "Обліковий запис",
      signOutDescription: "Вийти з облікового запису Germes на цьому пристрої.",
      signOut: "Вийти",
    },
  },
};
