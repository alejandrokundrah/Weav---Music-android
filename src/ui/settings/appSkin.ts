import { useSyncExternalStore } from "react";
import { isAndroid } from "../platform";
import {
  hydrateLocalJsonSetting,
  readLocalJsonSetting,
  writeLocalJsonSetting,
} from "../../internal/durableLocalSetting";

/**
 * Which desktop skin the main window wears.
 *
 * - `glass` — the original: a frosted pane over soft scenery, lime accents. The default, and
 *   exactly what every install showed before skins existed.
 * - `noir` — pure black, a top navigation bar, a text-only library list, a docked player and a
 *   single red accent.
 *
 * Not to be confused with the *mini player* skins (`miniPlayer.ts`), which only restyle that one
 * small window. This one decides the chrome of the whole app.
 *
 * Desktop only. A phone keeps its own opaque layout whatever is stored here, which is why
 * `applyAppSkin` does nothing on Android and the picker lives in a desktop-only settings card.
 */
export type AppSkinId = "glass" | "noir";

const STORAGE_KEY = "app-skin";
const CHANGE_EVENT = "app-skin-change";
export const DEFAULT_APP_SKIN: AppSkinId = "glass";

export const APP_SKINS: ReadonlyArray<{ id: AppSkinId; name: string; description: string }> = [
  {
    id: "glass",
    name: "Glass",
    description: "A frosted window over soft scenery, with lime accents.",
  },
  {
    id: "noir",
    name: "Noir",
    description: "Pure black, a top navigation bar and a single red accent.",
  },
];

function isAppSkinId(value: unknown): value is AppSkinId {
  return value === "glass" || value === "noir";
}

/*
 * Cached for the same reason as the Potato PC flag: `useAppSkin` is read by the app shell, the
 * layout, every media header and the player bar, and `useSyncExternalStore` asks for the snapshot
 * more than once per render. Uncached, that is a `JSON.parse` of a storage string per read for a
 * value that only changes when someone opens Settings.
 */
let cached: AppSkinId | null = null;

export function readAppSkin(): AppSkinId {
  // A phone has no skins to choose from, so a stored value (synced in from a desktop install,
  // say) must never leak into its layout.
  if (isAndroid) return DEFAULT_APP_SKIN;
  if (cached === null) {
    cached = readLocalJsonSetting(STORAGE_KEY, isAppSkinId) ?? DEFAULT_APP_SKIN;
  }
  return cached;
}

function invalidate() {
  cached = null;
}

// At module scope so the cache is already stale before any React subscriber runs.
if (typeof window !== "undefined") {
  window.addEventListener(CHANGE_EVENT, invalidate);
  window.addEventListener("storage", invalidate);
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * Puts the skin on <html>.
 *
 * `data-glass` is what the existing glass palette keys off (see global.css), so it is present
 * for `glass` and absent for `noir`. For the default skin that is exactly the attribute `main.tsx`
 * used to set unconditionally, which is what keeps the original look byte-for-byte unchanged.
 */
export function applyAppSkin(skin: AppSkinId = readAppSkin()): void {
  if (typeof document === "undefined" || isAndroid) return;

  const root = document.documentElement;
  root.setAttribute("data-app-skin", skin);
  root.toggleAttribute("data-glass", skin === "glass");
}

export function setAppSkin(skin: AppSkinId): void {
  cached = skin;
  writeLocalJsonSetting(STORAGE_KEY, skin);
  applyAppSkin(skin);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Backfills a machine whose local storage was cleared from the durable store. */
export async function hydrateAppSkin(): Promise<void> {
  await hydrateLocalJsonSetting(STORAGE_KEY, isAppSkinId);
  invalidate();
  applyAppSkin();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useAppSkin(): AppSkinId {
  return useSyncExternalStore(subscribe, readAppSkin, () => DEFAULT_APP_SKIN);
}
