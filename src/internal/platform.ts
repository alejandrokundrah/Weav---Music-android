/**
 * Platform detection utilities
 *
 * Provides helpers to detect the current platform and make platform-specific decisions.
 */

import { invoke } from "@tauri-apps/api/core";

export type Platform = "android" | "ios" | "windows" | "macos" | "linux" | "unknown";

let cachedPlatform: Platform | null = null;

/**
 * Get the current platform
 * @returns The platform string
 */
export async function getPlatform(): Promise<Platform> {
  if (cachedPlatform) {
    return cachedPlatform;
  }

  try {
    const platform = await invoke<string>("platform");
    cachedPlatform = platform as Platform;
    return cachedPlatform;
  } catch {
    // Fallback to detection via userAgent if Tauri command fails
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes("android")) {
      cachedPlatform = "android";
    } else if (userAgent.includes("iphone") || userAgent.includes("ipad")) {
      cachedPlatform = "ios";
    } else if (userAgent.includes("win")) {
      cachedPlatform = "windows";
    } else if (userAgent.includes("mac")) {
      cachedPlatform = "macos";
    } else if (userAgent.includes("linux")) {
      cachedPlatform = "linux";
    } else {
      cachedPlatform = "unknown";
    }

    return cachedPlatform;
  }
}

/**
 * Check if running on Android
 * @returns true if on Android
 */
export async function isAndroid(): Promise<boolean> {
  const platform = await getPlatform();
  return platform === "android";
}

/**
 * Check if running on iOS
 * @returns true if on iOS
 */
export async function isIOS(): Promise<boolean> {
  const platform = await getPlatform();
  return platform === "ios";
}

/**
 * Check if running on mobile (Android or iOS)
 * @returns true if on mobile
 */
export async function isMobile(): Promise<boolean> {
  const platform = await getPlatform();
  return platform === "android" || platform === "ios";
}

/**
 * Check if running on desktop (Windows, macOS, or Linux)
 * @returns true if on desktop
 */
export async function isDesktop(): Promise<boolean> {
  const platform = await getPlatform();
  return platform === "windows" || platform === "macos" || platform === "linux";
}

/**
 * Check if running on Windows
 * @returns true if on Windows
 */
export async function isWindows(): Promise<boolean> {
  const platform = await getPlatform();
  return platform === "windows";
}

/**
 * Check if running on macOS
 * @returns true if on macOS
 */
export async function isMacOS(): Promise<boolean> {
  const platform = await getPlatform();
  return platform === "macos";
}

/**
 * Check if running on Linux
 * @returns true if on Linux
 */
export async function isLinux(): Promise<boolean> {
  const platform = await getPlatform();
  return platform === "linux";
}

/**
 * Synchronous check for Android (for performance-critical code paths)
 * This uses userAgent detection and may be less accurate than async getPlatform()
 * @returns true if likely on Android
 */
export function isAndroidSync(): boolean {
  return navigator.userAgent.toLowerCase().includes("android");
}

/**
 * Synchronous check for mobile (for performance-critical code paths)
 * @returns true if likely on mobile
 */
export function isMobileSync(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes("android") ||
         userAgent.includes("iphone") ||
         userAgent.includes("ipad");
}
