import { useSyncExternalStore } from "react";
import { setAppSetting } from "../../internal/appSettings";

/**
 * Colour theme. WEAV is exclusively designed with a dark theme.
 */
export type ThemePreference = "dark";
export type ResolvedTheme = "dark";

const STORAGE_KEY = "theme";
const CHANGE_EVENT = "theme-change";

export function readThemePreference(): ThemePreference {
  return "dark";
}

export function resolveTheme(_preference?: unknown): ResolvedTheme {
  return "dark";
}

/**
 * Writes `data-theme="dark"` on <html> and sets dark color-scheme.
 */
export function applyTheme(_preference?: unknown): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", "dark");
  document.documentElement.style.colorScheme = "dark";
}

export function setThemePreference(_preference?: unknown): void {
  try {
    localStorage.setItem(STORAGE_KEY, "dark");
  } catch {
    // Durable app settings still get the write below.
  }
  applyTheme("dark");
  window.dispatchEvent(new Event(CHANGE_EVENT));
  void setAppSetting(STORAGE_KEY, "dark");
}

export async function hydrateTheme(): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, "dark");
  } catch {
    // Storage fallback
  }

  applyTheme("dark");
  window.dispatchEvent(new Event(CHANGE_EVENT));
  void setAppSetting(STORAGE_KEY, "dark");
}

/** App is dark-only; no OS theme switching is permitted. */
export function watchSystemTheme(): () => void {
  applyTheme("dark");
  return () => {};
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, readThemePreference, () => "dark" as const);
}
