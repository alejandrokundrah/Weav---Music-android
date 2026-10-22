import { useEffect } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { playerController, tabManager } from "../../../player/playerStore";
import { isSyncedLyrics } from "../../pages/lyricsTiming";
import { getLyricsOffset } from "../../settings/lyricsOffset";
import { logInternalWarn } from "../../../internal/logging";

/** One lyric line as the notch window receives it: just a start time and the words. */
export interface NotchLyricLine {
  time: number;
  text: string;
}

export interface NotchLyricsSync {
  trackId: string | null;
  /** Empty when the song has no timed lyrics; the notch then drops its lyrics column. */
  lines: NotchLyricLine[];
  /** Seconds added to playback time before matching a line, the same offset the lyrics view uses. */
  offset: number;
}

const EMPTY: NotchLyricsSync = { trackId: null, lines: [], offset: 0 };

/**
 * Feeds the notch window its lyrics. Renders nothing.
 *
 * The notch is its own webview and cannot reach the data source, so the main window looks the
 * lyrics up and hands over only what a one-line display needs. It does this only while the
 * notch window exists: a lookup costs a network round trip, and nobody is reading the result
 * otherwise.
 *
 * Playback state and time need no help from here. The notch reads them off the same
 * `player-state-sync` / `player-time-sync` events the mini player uses.
 */
export function NotchBridge({ live }: { live: boolean }) {
  useEffect(() => {
    if (!live) return;

    let cancelled = false;
    let loadedTrackId: string | null = null;
    let latest: NotchLyricsSync = EMPTY;

    const send = (payload: NotchLyricsSync) => {
      latest = payload;
      void emit("notch-lyrics-sync", payload);
    };

    const load = () => {
      const track = tabManager.getActiveState().currentTrack ?? null;
      const trackId = track?.id ?? null;
      if (trackId === loadedTrackId) return;
      loadedTrackId = trackId;

      // The previous song's words must not linger while the next lookup is in flight.
      send({ ...EMPTY, trackId });
      if (!track) return;

      void playerController.getLyrics(track)
        .then((lyrics) => {
          if (cancelled || loadedTrackId !== track.id) return;
          if (!lyrics || !isSyncedLyrics(lyrics)) return;
          send({
            trackId: track.id,
            offset: getLyricsOffset(track.id),
            lines: lyrics.lines
              .filter((line) => line.text.trim().length > 0)
              .map((line) => ({ time: line.startTimeSec ?? 0, text: line.text.trim() })),
          });
        })
        .catch((error) => {
          logInternalWarn("Notch lyrics lookup failed", {
            trackId: track.id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
    };

    load();
    const unsubscribe = tabManager.subscribe(load);

    // A window that has just appeared has missed everything sent so far.
    const resync = listen("notch:request-lyrics", () => send(latest));

    return () => {
      cancelled = true;
      unsubscribe();
      void resync.then((unlisten) => unlisten());
    };
  }, [live]);

  return null;
}
