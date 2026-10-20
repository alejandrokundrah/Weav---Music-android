import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";

/**
 * Supported languages for the app UI.
 */
export const APP_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number]["code"];

const STORAGE_KEY = "app-language";

/**
 * Get the saved language preference, or fall back to browser/system default.
 */
function getInitialLanguage(): AppLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && APP_LANGUAGES.some((lang) => lang.code === saved)) {
      return saved as AppLanguage;
    }
  } catch {
    // Ignore localStorage errors
  }

  // Fall back to browser language if it's supported
  const browserLang = navigator.language.split("-")[0];
  if (APP_LANGUAGES.some((lang) => lang.code === browserLang)) {
    return browserLang as AppLanguage;
  }

  return "en";
}

/**
 * Initialize i18next with English, Spanish, and French translations.
 */
i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
    },
    lng: getInitialLanguage(),
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

/**
 * Save language preference to localStorage.
 */
export function setAppLanguage(lang: AppLanguage): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Ignore localStorage errors
  }
  void i18n.changeLanguage(lang);
}

/**
 * Get the current language code.
 */
export function getAppLanguage(): AppLanguage {
  return i18n.language as AppLanguage;
}

export default i18n;
