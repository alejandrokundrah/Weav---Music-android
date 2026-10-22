/**
 * Native Android event listeners
 *
 * Handles Tauri events emitted from native Android components
 * such as playback state changes, position updates, and track end.
 */

import { listen } from "@tauri-apps/api/event";
import { logInternalError, logInternalInfo, logInternalWarn } from "../internal/logging";
import { isAndroidSync } from "../internal/platform";

// Event names must match the Rust side
const EVENT_PLAYBACK_STATE_CHANGED = "native-playback-state-changed";
const EVENT_POSITION_CHANGED = "native-position-changed";
const EVENT_TRACK_ENDED = "native-track-ended";
const EVENT_DOWNLOAD_PROGRESS = "native-download-progress";

// Callback storage
let playbackStateCallback: ((isPlaying: boolean) => void) | null = null;
let positionCallback: ((positionMs: number) => void) | null = null;
let trackEndedCallback: (() => void) | null = null;
let downloadProgressCallback: ((progress: number) => void) | null = null;

// Unlisten functions
let playbackStateUnlisten: (() => void) | null = null;
let positionUnlisten: (() => void) | null = null;
let trackEndedUnlisten: (() => void) | null = null;
let downloadProgressUnlisten: (() => void) | null = null;

/**
 * Register callback for playback state changes
 */
export async function registerPlaybackStateCallback(
  callback: (isPlaying: boolean) => void
): Promise<void> {
  if (!isAndroidSync()) {
    logInternalWarn("Native Android events: not on Android, skipping registration");
    return;
  }

  playbackStateCallback = callback;

  // Unlisten previous listener if exists
  if (playbackStateUnlisten) {
    playbackStateUnlisten();
  }

  try {
    const unlisten = await listen<boolean>(EVENT_PLAYBACK_STATE_CHANGED, (event) => {
      logInternalInfo("Native Android event: playback state changed", {
        isPlaying: event.payload,
      });
      playbackStateCallback?.(event.payload);
    });
    playbackStateUnlisten = unlisten;
    logInternalInfo("Native Android events: playback state listener registered");
  } catch (error) {
    logInternalError("Native Android events: failed to register playback state listener", error);
  }
}

/**
 * Register callback for position updates
 */
export async function registerPositionCallback(
  callback: (positionMs: number) => void
): Promise<void> {
  if (!isAndroidSync()) {
    logInternalWarn("Native Android events: not on Android, skipping registration");
    return;
  }

  positionCallback = callback;

  // Unlisten previous listener if exists
  if (positionUnlisten) {
    positionUnlisten();
  }

  try {
    const unlisten = await listen<number>(EVENT_POSITION_CHANGED, (event) => {
      logInternalInfo("Native Android event: position changed", {
        positionMs: event.payload,
      });
      positionCallback?.(event.payload);
    });
    positionUnlisten = unlisten;
    logInternalInfo("Native Android events: position listener registered");
  } catch (error) {
    logInternalError("Native Android events: failed to register position listener", error);
  }
}

/**
 * Register callback for track end
 */
export async function registerTrackEndedCallback(callback: () => void): Promise<void> {
  if (!isAndroidSync()) {
    logInternalWarn("Native Android events: not on Android, skipping registration");
    return;
  }

  trackEndedCallback = callback;

  // Unlisten previous listener if exists
  if (trackEndedUnlisten) {
    trackEndedUnlisten();
  }

  try {
    const unlisten = await listen(EVENT_TRACK_ENDED, () => {
      logInternalInfo("Native Android event: track ended");
      trackEndedCallback?.();
    });
    trackEndedUnlisten = unlisten;
    logInternalInfo("Native Android events: track ended listener registered");
  } catch (error) {
    logInternalError("Native Android events: failed to register track ended listener", error);
  }
}

/**
 * Register callback for download progress
 */
export async function registerDownloadProgressCallback(
  callback: (progress: number) => void
): Promise<void> {
  if (!isAndroidSync()) {
    logInternalWarn("Native Android events: not on Android, skipping registration");
    return;
  }

  downloadProgressCallback = callback;

  // Unlisten previous listener if exists
  if (downloadProgressUnlisten) {
    downloadProgressUnlisten();
  }

  try {
    const unlisten = await listen<number>(EVENT_DOWNLOAD_PROGRESS, (event) => {
      logInternalInfo("Native Android event: download progress", {
        progress: event.payload,
      });
      downloadProgressCallback?.(event.payload);
    });
    downloadProgressUnlisten = unlisten;
    logInternalInfo("Native Android events: download progress listener registered");
  } catch (error) {
    logInternalError("Native Android events: failed to register download progress listener", error);
  }
}

/**
 * Unregister all event listeners
 */
export function unregisterAllListeners(): void {
  if (playbackStateUnlisten) {
    playbackStateUnlisten();
    playbackStateUnlisten = null;
  }
  if (positionUnlisten) {
    positionUnlisten();
    positionUnlisten = null;
  }
  if (trackEndedUnlisten) {
    trackEndedUnlisten();
    trackEndedUnlisten = null;
  }
  if (downloadProgressUnlisten) {
    downloadProgressUnlisten();
    downloadProgressUnlisten = null;
  }

  playbackStateCallback = null;
  positionCallback = null;
  trackEndedCallback = null;
  downloadProgressCallback = null;

  logInternalInfo("Native Android events: all listeners unregistered");
}
