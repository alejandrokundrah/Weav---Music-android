import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { Lyrics } from "../../../datasource/types";
import { playerController, shallowEqual, usePlayerSelector } from "../../../player/playerStore";
import { usePlayerUIState } from "../../stores/playerUIStore";
import { findActiveLineIndex, isSyncedLyrics } from "../../pages/lyricsTiming";
import { TrackArtwork } from "../TrackArtwork";

/** How many lines the card shows at once. Odd, so the active line can sit in the middle. */
const VISIBLE_LINES = 9;
/** Sampling period. Coarser than the full lyrics view's frame loop: this only has to pick a line. */
const SAMPLE_MS = 300;

/**
 * The mint card at the foot of the queue rail: the song's lyrics as a small, glanceable window.
 *
 * A read-only echo of the full lyrics page — same lookup (`playerController.getLyrics`, which
 * the page also goes through, so the result is shared rather than fetched twice), same line
 * picker (`findActiveLineIndex`) — without the sweep, translation, offset controls or source
 * panel, none of which belong in a 300px card. Clicking it opens the real thing.
 *
 * Synced lyrics scroll to keep the sung line centred; unsynced ones just show the opening
 * lines. The ends fade out with a mask rather than being cut, which is what makes it read as
 * a window onto a longer text.
 */
export function LyricsCard({ onOpen }: { onOpen?: () => void }) {
  const track = usePlayerSelector((player) => player.currentTrack, shallowEqual);
  const isLyricsOpen = usePlayerUIState().isLyricsOpen;
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  /** Whether the lookup has finished, so "still looking" and "nothing found" read differently. */
  const [isSettled, setIsSettled] = useState(false);

  const trackId = track?.id;
  useEffect(() => {
    setLyrics(null);
    setActiveIndex(-1);
    setIsSettled(false);
    if (!track) return;

    let cancelled = false;
    void playerController
      .getLyrics(track)
      .then((result) => {
        if (cancelled) return;
        setLyrics(result);
        setIsSettled(true);
      })
      // A missing lyric is an ordinary outcome here, and the full page already logs failures.
      .catch(() => {
        if (!cancelled) setIsSettled(true);
      });
    return () => {
      cancelled = true;
    };
    // Keyed on the id: the track object is replaced on metadata refreshes that change nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  const lines = lyrics?.lines ?? [];
  const isSynced = isSyncedLyrics(lyrics);

  useEffect(() => {
    if (!isSynced) {
      setActiveIndex(-1);
      return;
    }
    const sample = () => {
      setActiveIndex(findActiveLineIndex(lines, playerController.getCurrentTime()));
    };
    sample();
    const interval = window.setInterval(sample, SAMPLE_MS);
    return () => window.clearInterval(interval);
    // `lines` is derived from `lyrics`; depending on it directly would rebuild every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSynced, lyrics]);

  const windowed = useMemo(() => {
    if (lines.length === 0) return [];
    const centre = isSynced ? Math.max(activeIndex, 0) : 0;
    const half = Math.floor(VISIBLE_LINES / 2);
    // Pinned to the ends so a song's first and last lines do not leave a half-empty card.
    const start = Math.min(Math.max(0, centre - half), Math.max(0, lines.length - VISIBLE_LINES));
    return lines.slice(start, start + VISIBLE_LINES).map((line, offset) => ({
      text: line.text,
      index: start + offset,
    }));
  }, [lines, activeIndex, isSynced]);

  if (!track || isLyricsOpen) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open lyrics"
      className={cn(
        "group/lyrics mx-3 mb-3 flex h-72 shrink-0 flex-col gap-3 overflow-hidden rounded-3xl p-4 text-left",
        "bg-[var(--glass-lyrics,var(--color-primary))] text-[var(--glass-lyrics-ink,var(--color-primary-foreground))]",
        "shadow-lg shadow-black/15 transition-transform hover:scale-[1.01] active:scale-[0.995]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span className="flex shrink-0 items-center gap-3">
        <TrackArtwork
          className="size-10 shrink-0 rounded-lg shadow-md shadow-black/20"
          size={40}
          artworkUrl={track.artworkUrl}
          iconSize={18}
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-lexend text-sm font-normal">{track.title}</span>
          <span className="truncate text-xs opacity-70">{track.artist}</span>
        </span>
      </span>

      <span
        className={cn(
          "relative flex min-h-0 flex-1 flex-col justify-center gap-0.5 overflow-hidden",
          "[mask-image:linear-gradient(to_bottom,transparent,black_22%,black_78%,transparent)]",
        )}
      >
        {windowed.length > 0 ? (
          windowed.map(({ text, index }) =>
            text.trim() ? (
              <span
                key={index}
                className={cn(
                  "truncate font-lexend text-[13px] leading-6 transition-opacity duration-300",
                  index === activeIndex ? "font-medium opacity-100" : "font-light opacity-65",
                )}
              >
                {text}
              </span>
            ) : (
              // An instrumental beat or a stanza break: keep the gap, drop the glyphs.
              <span key={index} className="h-3" aria-hidden="true" />
            ),
          )
        ) : (
          <span className="text-center font-lexend text-sm font-light opacity-70">
            {isSettled ? "No lyrics for this song" : "Looking for lyrics…"}
          </span>
        )}
      </span>
    </button>
  );
}
