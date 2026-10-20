import type { SampleEventName } from "./types";

const STORAGE_KEY = "weav.samples.events.v1";
const MAX_EVENTS = 400;

export interface SampleEvent {
  name: SampleEventName;
  at: number;
  sampleId?: string;
  songId?: string;
  [key: string]: unknown;
}

let buffer: SampleEvent[] | null = null;

function load(): SampleEvent[] {
  if (buffer) return buffer;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    buffer = Array.isArray(parsed) ? parsed : [];
  } catch {
    buffer = [];
  }
  return buffer;
}

let flushTimer: number | null = null;
function scheduleFlush() {
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(load()));
    } catch {
      // Storage full or unavailable: the in-memory log still serves this session.
    }
  }, 1500);
}

/**
 * Records a Samples event on this device. There is no analytics backend; the log is read back
 * by the feed to learn what to stop showing (see `getQuicklySkippedSongIds`) and is shaped so
 * it can be shipped to a server unchanged.
 */
export function trackSampleEvent(
  name: SampleEventName,
  payload: { sampleId?: string; songId?: string } & Record<string, unknown> = {},
): void {
  const events = load();
  events.push({ name, at: Date.now(), ...payload });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  scheduleFlush();
}

export function getSampleEvents(): readonly SampleEvent[] {
  return load();
}

/** Songs the listener moved past within a couple of seconds, more than once is a clear no. */
export function getQuicklySkippedSongIds(): Set<string> {
  const counts = new Map<string, number>();
  for (const event of load()) {
    if (event.name === "sample_skipped" && typeof event.songId === "string"
      && typeof event.listenedSec === "number" && event.listenedSec < 3) {
      counts.set(event.songId, (counts.get(event.songId) ?? 0) + 1);
    }
  }
  return new Set([...counts].filter(([, count]) => count >= 2).map(([id]) => id));
}
