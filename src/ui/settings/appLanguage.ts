import { useSyncExternalStore } from "react";
import { setAppLanguage, getAppLanguage, type AppLanguage, APP_LANGUAGES } from "@/lib/i18n";

const STORAGE_KEY = "app-language";
const CHANGE_EVENT = "app-language-change";

/**
 * Save language preference to localStorage.
 */
function setLanguageInStorage(lang: AppLanguage): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Ignore localStorage errors
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Hook to get and set the app language.
 */
export function useAppLanguage(): AppLanguage {
  return useSyncExternalStore(
    (listener) => {
      window.addEventListener(CHANGE_EVENT, listener);
      window.addEventListener("storage", listener);
      return () => {
        window.removeEventListener(CHANGE_EVENT, listener);
        window.removeEventListener("storage", listener);
      };
    },
    getAppLanguage,
    () => "en",
  );
}

/**
 * Hook to set the app language.
 */
export function setAppLanguageWithStorage(lang: AppLanguage): void {
  setLanguageInStorage(lang);
  setAppLanguage(lang);
}

export { APP_LANGUAGES };
export type { AppLanguage };
