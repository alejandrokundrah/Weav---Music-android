import { useSyncExternalStore } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { isAndroid } from "../platform";
import {
  hydrateLocalBooleanSetting,
  readLocalBooleanSetting,
  writeLocalBooleanSetting,
} from "../../internal/durableLocalSetting";

/*
 * The notch: a second compact player that hangs from the top-centre of the screen.
 *
 * It sits alongside the mini player rather than replacing it. The mini player appears when the
 * main window loses focus; the notch is there for as long as something is playing. They share
 * the playback bridge (`player-state-sync`, `player-time-sync`, `mini-player:*` commands) and
 * differ only in when they show and how they look.
 *
 * Like the mini player, its window is created on demand rather than declared in
 * tauri.conf.json, so people who leave it off never pay for an idle WebView2 process.
 */
const NOTCH_LABEL = "notch";
const STORAGE_KEY = "notch-player-enabled";
const CHANGE_EVENT = "notch-player-enabled-change";

/** Window sizes in logical pixels. The window is exactly the shape, so it never blocks clicks. */
export const NOTCH_SIZES = {
  pill: { width: 288, height: 38 },
  compact: { width: 372, height: 132 },
  lyrics: { width: 580, height: 132 },
} as const;

export type NotchSizeKey = keyof typeof NOTCH_SIZES;

function readNotchEnabled() {
  // Off by default: it is a new window on screen that nobody asked for yet.
  return readLocalBooleanSetting(STORAGE_KEY, false);
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function setNotchEnabled(enabled: boolean) {
  writeLocalBooleanSetting(STORAGE_KEY, enabled, CHANGE_EVENT);
}

export function getNotchEnabled() {
  return readNotchEnabled();
}

export function useNotchEnabled() {
  return useSyncExternalStore(subscribe, readNotchEnabled, () => false);
}

export function hydrateNotchSettings() {
  return hydrateLocalBooleanSetting(STORAGE_KEY, false, CHANGE_EVENT);
}

/*
 * Whether the notch window exists right now. The main window only pushes playback time and
 * lyrics to a window somebody is listening in, the same rule the mini player follows.
 */
let notchWindowLive = false;
const liveListeners = new Set<() => void>();

function setNotchWindowLive(live: boolean): void {
  if (live === notchWindowLive) return;
  notchWindowLive = live;
  for (const listener of liveListeners) listener();
}

function subscribeToWindowLive(listener: () => void): () => void {
  liveListeners.add(listener);
  return () => {
    liveListeners.delete(listener);
  };
}

/** True while the notch window exists. */
export function useNotchWindowLive(): boolean {
  return useSyncExternalStore(subscribeToWindowLive, () => notchWindowLive, () => false);
}

// Creation and destruction share one chain, so the last call wins and none interleave.
let notchOps: Promise<unknown> = Promise.resolve();

function queueNotchOp<T>(op: () => Promise<T>): Promise<T> {
  const next = notchOps.then(op, op);
  notchOps = next.catch(() => undefined);
  return next;
}

async function createNotchWindow(): Promise<WebviewWindow | null> {
  const existing = await WebviewWindow.getByLabel(NOTCH_LABEL);
  if (existing) return existing;

  const { width, height } = NOTCH_SIZES.pill;
  return new Promise<WebviewWindow | null>((resolve) => {
    const notchWin = new WebviewWindow(NOTCH_LABEL, {
      url: "/notch.html",
      width,
      height,
      resizable: false,
      decorations: false,
      alwaysOnTop: true,
      transparent: true,
      // Shown by the notch itself once it has placed itself, and only while something plays.
      visible: false,
      shadow: false,
      skipTaskbar: true,
      // Clicking the notch must not take focus from the app underneath it. Focus leaving the
      // main window is what summons the mini player, so a focusable notch would summon it.
      focus: false,
      focusable: false,
    });
    void notchWin.once("tauri://created", () => resolve(notchWin));
    void notchWin.once("tauri://error", () => resolve(null));
  });
}

/** The notch window, creating it on first use. */
export function ensureNotchWindow(): Promise<WebviewWindow | null> {
  // Android has a single webview window; there is nothing to create.
  if (isAndroid) return Promise.resolve(null);
  const creation = queueNotchOp(createNotchWindow);
  void creation.then(
    (notchWin) => setNotchWindowLive(notchWin !== null),
    () => setNotchWindowLive(false),
  );
  return creation;
}

/** Frees the window's process. Hiding keeps it resident; only destroying returns the memory. */
export function destroyNotchWindow(): Promise<void> {
  if (isAndroid) return Promise.resolve();
  return queueNotchOp(async () => {
    setNotchWindowLive(false);
    const notchWin = await WebviewWindow.getByLabel(NOTCH_LABEL);
    if (!notchWin) return;
    try {
      await notchWin.destroy();
    } catch {
      // Already gone; nothing is left to free.
    }
  });
}
