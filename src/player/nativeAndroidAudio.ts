/**
 * Native Android audio integration
 *
 * Provides a bridge to the native Android ExoPlayer service via JNI.
 * This is used on Android to replace the Rust audio engine for better performance
 * and battery efficiency.
 */

import { invoke } from "@tauri-apps/api/core";
import { logInternalError, logInternalInfo } from "../internal/logging";
import { isAndroidSync } from "../internal/platform";
import * as nativeAndroidEvents from "./nativeAndroidEvents";

// Cache the position reported by the native player
let cachedPositionMs = 0;
let cachedDurationMs = 0;
let isPlayingCache = false;

/**
 * Check if native Android audio is available
 */
export function isNativeAndroidAudioAvailable(): boolean {
  return isAndroidSync();
}

/**
 * Play a track using the native Android ExoPlayer
 */
export async function playTrack(url: string, positionMs: number = 0): Promise<void> {
  if (!isNativeAndroidAudioAvailable()) {
    throw new Error("Native Android audio is not available on this platform");
  }

  try {
    await invoke("native_play_track", { url, positionMs });
    logInternalInfo("Native Android audio: playTrack called", { url, positionMs });
  } catch (error) {
    logInternalError("Native Android audio: playTrack failed", error);
    throw error;
  }
}

/**
 * Resume playback
 */
export async function play(): Promise<void> {
  if (!isNativeAndroidAudioAvailable()) {
    throw new Error("Native Android audio is not available on this platform");
  }

  try {
    await invoke("native_play");
    isPlayingCache = true;
    logInternalInfo("Native Android audio: play called");
  } catch (error) {
    logInternalError("Native Android audio: play failed", error);
    throw error;
  }
}

/**
 * Pause playback
 */
export async function pause(): Promise<void> {
  if (!isNativeAndroidAudioAvailable()) {
    throw new Error("Native Android audio is not available on this platform");
  }

  try {
    await invoke("native_pause");
    isPlayingCache = false;
    logInternalInfo("Native Android audio: pause called");
  } catch (error) {
    logInternalError("Native Android audio: pause failed", error);
    throw error;
  }
}

/**
 * Seek to a specific position
 */
export async function seekTo(positionMs: number): Promise<void> {
  if (!isNativeAndroidAudioAvailable()) {
    throw new Error("Native Android audio is not available on this platform");
  }

  try {
    await invoke("native_seek_to", { positionMs });
    cachedPositionMs = positionMs;
    logInternalInfo("Native Android audio: seekTo called", { positionMs });
  } catch (error) {
    logInternalError("Native Android audio: seekTo failed", error);
    throw error;
  }
}

/**
 * Set volume (0.0 to 1.0)
 */
export async function setVolume(volume: number): Promise<void> {
  if (!isNativeAndroidAudioAvailable()) {
    throw new Error("Native Android audio is not available on this platform");
  }

  try {
    await invoke("native_set_volume", { volume });
    logInternalInfo("Native Android audio: setVolume called", { volume });
  } catch (error) {
    logInternalError("Native Android audio: setVolume failed", error);
    throw error;
  }
}

/**
 * Set playback rate (0.5 to 2.0)
 */
export async function setPlaybackRate(rate: number): Promise<void> {
  if (!isNativeAndroidAudioAvailable()) {
    throw new Error("Native Android audio is not available on this platform");
  }

  try {
    await invoke("native_set_playback_rate", { rate });
    logInternalInfo("Native Android audio: setPlaybackRate called", { rate });
  } catch (error) {
    logInternalError("Native Android audio: setPlaybackRate failed", error);
    throw error;
  }
}

/**
 * Get current playback position in milliseconds
 */
export async function getCurrentPosition(): Promise<number> {
  if (!isNativeAndroidAudioAvailable()) {
    throw new Error("Native Android audio is not available on this platform");
  }

  try {
    const position = await invoke<number>("native_get_current_position");
    cachedPositionMs = position;
    return position;
  } catch (error) {
    logInternalError("Native Android audio: getCurrentPosition failed", error);
    // Return cached value on error
    return cachedPositionMs;
  }
}

/**
 * Get total duration in milliseconds
 */
export async function getDuration(): Promise<number> {
  if (!isNativeAndroidAudioAvailable()) {
    throw new Error("Native Android audio is not available on this platform");
  }

  try {
    const duration = await invoke<number>("native_get_duration");
    cachedDurationMs = duration;
    return duration;
  } catch (error) {
    logInternalError("Native Android audio: getDuration failed", error);
    // Return cached value on error
    return cachedDurationMs;
  }
}

/**
 * Check if currently playing
 */
export async function isPlaying(): Promise<boolean> {
  if (!isNativeAndroidAudioAvailable()) {
    throw new Error("Native Android audio is not available on this platform");
  }

  try {
    const playing = await invoke<boolean>("native_is_playing");
    isPlayingCache = playing;
    return playing;
  } catch (error) {
    logInternalError("Native Android audio: isPlaying failed", error);
    // Return cached value on error
    return isPlayingCache;
  }
}

/**
 * Skip to next track
 */
export async function skipToNext(): Promise<void> {
  if (!isNativeAndroidAudioAvailable()) {
    throw new Error("Native Android audio is not available on this platform");
  }

  try {
    await invoke("native_skip_to_next");
    logInternalInfo("Native Android audio: skipToNext called");
  } catch (error) {
    logInternalError("Native Android audio: skipToNext failed", error);
    throw error;
  }
}

/**
 * Skip to previous track
 */
export async function skipToPrevious(): Promise<void> {
  if (!isNativeAndroidAudioAvailable()) {
    throw new Error("Native Android audio is not available on this platform");
  }

  try {
    await invoke("native_skip_to_previous");
    logInternalInfo("Native Android audio: skipToPrevious called");
  } catch (error) {
    logInternalError("Native Android audio: skipToPrevious failed", error);
    throw error;
  }
}

/**
 * Stop playback
 */
export async function stop(): Promise<void> {
  if (!isNativeAndroidAudioAvailable()) {
    throw new Error("Native Android audio is not available on this platform");
  }

  try {
    await invoke("native_stop");
    isPlayingCache = false;
    cachedPositionMs = 0;
    logInternalInfo("Native Android audio: stop called");
  } catch (error) {
    logInternalError("Native Android audio: stop failed", error);
    throw error;
  }
}

/**
 * Register event listeners for native Android callbacks
 */
export async function registerEventListeners(
  onPlaybackStateChanged?: (isPlaying: boolean) => void,
  onPositionChanged?: (positionMs: number) => void,
  onTrackEnded?: () => void,
): Promise<void> {
  if (!isNativeAndroidAudioAvailable()) {
    return;
  }

  try {
    // Register Tauri event listeners
    if (onPlaybackStateChanged) {
      await nativeAndroidEvents.registerPlaybackStateCallback((isPlaying) => {
        isPlayingCache = isPlaying;
        onPlaybackStateChanged(isPlaying);
      });
    }
    if (onPositionChanged) {
      await nativeAndroidEvents.registerPositionCallback((positionMs) => {
        cachedPositionMs = positionMs;
        onPositionChanged(positionMs);
      });
    }
    if (onTrackEnded) {
      await nativeAndroidEvents.registerTrackEndedCallback(onTrackEnded);
    }

    // Tell Rust we're ready to receive events
    await invoke("register_playback_state_callback");
    await invoke("register_position_callback");
    await invoke("register_track_ended_callback");

    logInternalInfo("Native Android audio: event listeners registered");
  } catch (error) {
    logInternalError("Native Android audio: failed to register event listeners", error);
  }
}

/**
 * Unregister all event listeners
 */
export function unregisterEventListeners(): void {
  nativeAndroidEvents.unregisterAllListeners();
  logInternalInfo("Native Android audio: event listeners unregistered");
}

/**
 * Sync wrapper for getCurrentPosition (returns cached value synchronously)
 */
export function getCurrentPositionSync(): number {
  return cachedPositionMs;
}

/**
 * Sync wrapper for getDuration (returns cached value synchronously)
 */
export function getDurationSync(): number {
  return cachedDurationMs;
}

/**
 * Sync wrapper for isPlaying (returns cached value synchronously)
 */
export function isPlayingSync(): boolean {
  return isPlayingCache;
}
