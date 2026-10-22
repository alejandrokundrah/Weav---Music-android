import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/motion/tooltip";
import { CheckIcon, DownloadIcon, ListIcon, PauseActiveIcon, PlayActiveIcon, PlaylistAddIcon, RepeatActiveIcon, RepeatOneActiveIcon, ShuffleActiveIcon } from "@/ui/icons";
import { SpinnerSteps } from "@/components/motion/loader";
import { TrackArtwork } from "./TrackArtwork";
import { setAmbientArtwork } from "../stores/ambientArtworkStore";
import { useAppSkin } from "../settings/appSkin";
import { NoirMediaHeader } from "../skins/noir/NoirMediaHeader";
import { AzureMediaHeader } from "../skins/azure/AzureMediaHeader";

/**
 * "24 songs · 1 hr 32 min".
 *
 * The duration is dropped unless every counted track reported one and the list is fully
 * loaded. YouTube omits `durationSec` on most playlist entries, so summing what happens to
 * be present produced badly wrong totals — a 98-track playlist read "98 songs · 3 min".
 * A missing total is honest; a wrong one is not.
 */
export function formatCollectionMeta(
  tracks: readonly { durationSec?: number }[],
  hasMore = false,
): string {
  const trackCount = tracks.length;
  const countLabel = `${trackCount}${hasMore ? "+" : ""} ${trackCount === 1 ? "song" : "songs"}`;
  if (hasMore || trackCount === 0) return countLabel;

  let totalDurationSec = 0;
  for (const track of tracks) {
    if (!track.durationSec) return countLabel;
    totalDurationSec += track.durationSec;
  }

  const totalMinutes = Math.round(totalDurationSec / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const durationLabel = hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`;
  return `${countLabel} · ${durationLabel}`;
}

/**
 * Controls that sit on the hero image. The image can be anything, so these carry their own dark
 * veil and a hairline instead of borrowing the page's `bg-card`, which is a faint white that
 * disappears over a bright photo.
 */
export const HERO_PILL =
  "flex items-center gap-2 rounded-full bg-black/25 px-5 py-2.5 text-sm font-medium text-white ring-1 ring-inset ring-white/35 backdrop-blur-sm transition-colors hover:bg-black/40 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";
export const HERO_ICON_BUTTON =
  "flex size-11 items-center justify-center rounded-full bg-black/25 text-white ring-1 ring-inset ring-white/35 backdrop-blur-sm transition-colors hover:bg-black/40 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

/**
 * What the download control should say, given how much of a collection is already offline.
 *
 * Shared by every skin's header so "all 12 downloaded" and "download 9 songs" are worded once.
 */
export function describeCollectionDownload(
  counts: { downloaded: number; total: number; isPartial?: boolean } | undefined,
): { allDownloaded: boolean; tooltip: string; label: string } {
  const total = counts?.total ?? 0;
  const downloaded = counts?.downloaded ?? 0;
  const remaining = Math.max(0, total - downloaded);
  // Never "all downloaded" while pages remain unfetched — the unseen ones are not.
  const allDownloaded = total > 0 && remaining === 0 && !counts?.isPartial;

  return {
    allDownloaded,
    tooltip: allDownloaded
      ? "Every song here is downloaded"
      : counts?.isPartial
        ? "Download every song here for offline"
        : remaining > 0
          ? `Download ${remaining} song${remaining === 1 ? "" : "s"} for offline`
          : "Download for offline",
    label: allDownloaded ? "Already downloaded" : "Download for offline",
  };
}

export interface MediaHeaderProps {
  /** Small uppercase kicker: PLAYLIST, ALBUM, ARTIST. */
  eyebrow: string;
  /** ReactNode so a page can make the title interactive — the artist page's copies its URL. */
  title: ReactNode;
  /** Owner, artist links — the line directly under the title. */
  subtitle?: ReactNode;
  /** Counts and durations; rendered quieter than the subtitle. */
  meta?: ReactNode;
  artworkUrl?: string;
  artworkVariant?: "track" | "album" | "artist" | "playlist";
  /** Replaces the artwork entirely — Liked Songs uses its own glyph. */
  artworkSlot?: ReactNode;
  /** Artists read as people, so their image is circular. */
  circularArtwork?: boolean;
  /**
   * The primary play/pause control. Omit to hide it.
   *
   * Grouped rather than three sibling props because the three are meaningless apart: an
   * `isPlaying` with no handler renders a button that does nothing, and a `isLoading` with no
   * handler renders a spinner that never resolves. As one optional object those states cannot
   * be expressed at all.
   */
  playback?: {
    /** Called for both play and pause — the page decides which, from `isPlaying`. */
    onToggle: () => void;
    /** True while a track from *this* collection is playing, so the button reads "Pause". */
    isPlaying?: boolean;
    /** This collection is starting playback; the button holds its width and shows a spinner. */
    isLoading?: boolean;
  };
  onShuffle?: () => void;
  /** Queues every track in this collection behind what is already hand-picked. */
  onAddToQueue?: () => void;
  /** Adds every track in this collection to a playlist, via the usual picker. */
  onAddToPlaylist?: () => void;
  /** Offline download for the whole collection. Omit to hide the control. */
  download?: {
    /** Queues every not-yet-downloaded track in this collection for offline use. */
    onStart: () => void;
    /**
     * The collection is still being paged in before the download can start.
     *
     * Worth showing: on a long playlist this takes several round trips, and a button that
     * looks idle after a click reads as broken and gets clicked again.
     */
    isBusy?: boolean;
    /**
     * How much of this collection is already offline, so the button can say what pressing it
     * would actually do — "all 12 downloaded" is a different message from "download 9 songs".
     */
    counts?: {
      downloaded: number;
      total: number;
      /** True while pages remain unfetched, so `total` is a floor rather than the real total. */
      isPartial?: boolean;
    };
  };
  /** Play-from-the-top-on-repeat. Omit to hide the control. */
  loop?: {
    /** Starts this collection with repeat-all enabled. */
    onPlay: () => void;
    /** Cycles repeat-all → repeat-one → off when this collection is already playing. */
    onCycle?: () => void;
    /** Current loop mode for the icon and accessible label. */
    mode?: "in-order" | "repeat-all" | "repeat-one";
  };
  actionsDisabled?: boolean;
  /** Extra controls beside play/shuffle, e.g. Subscribe. */
  actions?: ReactNode;
}

/** The blue check beside "Artist" — the design's verified-artist mark, drawn inline. */
function VerifiedMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true">
      <path
        fill="#4fb3ff"
        d="M12 1.8l2.4 1.7 2.9-.2 1.2 2.7 2.6 1.4-.3 2.9L22.4 12l-1.6 2.4.3 2.9-2.6 1.4-1.2 2.7-2.9-.2L12 22.9l-2.4-1.7-2.9.2-1.2-2.7-2.6-1.4.3-2.9L1.6 12l1.6-2.4-.3-2.9 2.6-1.4 1.2-2.7 2.9.2z"
      />
      <path fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M8 12.2l2.6 2.6L16 9.4" />
    </svg>
  );
}

/**
 * Shared hero for the playlist, album and artist pages.
 *
 * All three previously hand-rolled the same artwork + title + shuffle arrangement, which is
 * how they ended up subtly different sizes and how only some of them offered a given action.
 *
 * Two deliberate design choices:
 *
 * - **Play is the primary action, shuffle is secondary.** These pages only offered Shuffle,
 *   so the obvious intent — play this, in order — had no button at all.
 * - **The artwork tints its own header.** The image is reused, blown up and blurred behind
 *   the text, so each collection carries its own colour without a palette extraction step or
 *   a second network request. Kept faint so it never competes with the title.
 */
export function MediaHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  artworkUrl,
  artworkVariant = "playlist",
  artworkSlot,
  circularArtwork = false,
  playback,
  onShuffle,
  onAddToQueue,
  onAddToPlaylist,
  download,
  loop,
  actionsDisabled = false,
  actions,
}: MediaHeaderProps) {
  const skin = useAppSkin();
  const isNoir = skin === "noir";
  const isAzure = skin === "azure";
  /* Destructured once, so the body below reads the same as it did when these were flat props
     rather than threading `playback?.` through every branch. */
  const isPlaying = playback?.isPlaying ?? false;
  const isLoading = playback?.isLoading ?? false;
  const downloadBusy = download?.isBusy ?? false;
  const downloadCounts = download?.counts;
  const loopMode = loop?.mode ?? "in-order";
  const isLooping = loopMode !== "in-order";
  /*
   * The wash is painted by Layout, which sits above the scroll container this header lives
   * in — it has to start behind the search bar, and anything drawn here would be clipped at
   * the scroller's top edge. Cleared on unmount so the tint leaves with the page.
   */
  useEffect(() => {
    setAmbientArtwork(artworkUrl ?? null);
    return () => setAmbientArtwork(null);
  }, [artworkUrl]);

  const isBanner = circularArtwork;

  // Same props, a different hero: Noir lays the title out beside an arched portrait instead of
  // over a blurred wash. Everything above this line (the ambient tint) is harmless to share.
  if (isAzure) {
    return (
      <AzureMediaHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        meta={meta}
        artworkUrl={artworkUrl}
        artworkVariant={artworkVariant}
        artworkSlot={artworkSlot}
        circularArtwork={circularArtwork}
        playback={playback}
        onShuffle={onShuffle}
        onAddToQueue={onAddToQueue}
        onAddToPlaylist={onAddToPlaylist}
        download={download}
        loop={loop}
        actionsDisabled={actionsDisabled}
        actions={actions}
      />
    );
  }

  if (isNoir) {
    return (
      <NoirMediaHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        meta={meta}
        artworkUrl={artworkUrl}
        artworkVariant={artworkVariant}
        artworkSlot={artworkSlot}
        circularArtwork={circularArtwork}
        playback={playback}
        onShuffle={onShuffle}
        onAddToQueue={onAddToQueue}
        onAddToPlaylist={onAddToPlaylist}
        download={download}
        loop={loop}
        actionsDisabled={actionsDisabled}
        actions={actions}
      />
    );
  }

  return (
    <header className="relative isolate overflow-hidden rounded-3xl bg-black/20">
      {/*
        The hero image. An artist's photo runs full-bleed as the banner itself; an album or
        playlist cover is too square to stretch across the width, so it is blown up and blurred
        into a colour wash behind the sharp cover instead. Both sit under the same two scrims,
        which are what keep white text legible whatever the picture turns out to be.
      */}
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        {artworkUrl ? (
          isBanner ? (
            <TrackArtwork
              className="size-full object-cover object-[50%_20%]"
              artworkUrl={artworkUrl}
              size={640}
              iconSize={0}
              loading="eager"
              variant="artist"
              preferProxy
            />
          ) : (
            <div className="absolute inset-0 scale-125 opacity-80 blur-3xl saturate-150">
              <TrackArtwork
                className="size-full"
                artworkUrl={artworkUrl}
                size={120}
                iconSize={0}
                loading="eager"
                variant={artworkVariant}
              />
            </div>
          )
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/5" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/10 to-transparent" />
      </div>

      <div
        className={cn(
          "relative flex flex-wrap items-end gap-x-6 gap-y-4 p-6",
          // Artist banner: a short, wide strip like the Soundbeats hero — title, listener count and
          // actions share one baseline instead of stacking into a tall card.
          isBanner ? "min-h-[15.5rem] pt-24" : "pt-12",
        )}
      >
        {!isBanner && (
          artworkSlot ?? (
            <TrackArtwork
              className="size-40 shrink-0 rounded-2xl shadow-2xl shadow-black/40 ring-1 ring-white/15"
              artworkUrl={artworkUrl}
              iconSize={64}
              loading="eager"
              /* 160 CSS px — without it the full-size cover decodes into a 160px box. */
              size={160}
              variant={artworkVariant}
            />
          )
        )}

        <div className="flex min-w-0 flex-1 basis-72 flex-col gap-1">
          <span className="flex items-center gap-1.5 font-lexend text-sm font-light text-white/90">
            {isBanner && <VerifiedMark />}
            {eyebrow}
          </span>
          {/* Banner: the listener count sits on the title's baseline. Elsewhere it stacks below. */}
          <div className={cn(isBanner ? "flex flex-wrap items-baseline gap-x-3 gap-y-1" : "contents")}>
            {/* Long titles otherwise push the actions off the row entirely. */}
            <h1
              className={cn(
                "line-clamp-2 font-display font-semibold leading-[1.12] tracking-[0.005em] text-white",
                isBanner ? "text-5xl" : "text-6xl",
              )}
            >
              {title}
            </h1>
            {subtitle ? <div className="text-sm text-white/85">{subtitle}</div> : null}
            {meta ? <p className="text-sm text-white/75">{meta}</p> : null}
          </div>
        </div>

        <div className={cn("flex flex-wrap items-center gap-2", isBanner && "ml-auto")}>
          {playback ? (
            /*
             * Reflects this collection's own state, not the player's: it only becomes a
             * Pause control while the track being played belongs here. Playing something
             * else leaves this reading "Play", which is what the button would then do.
             */
            <Tooltip content={isPlaying ? "Pause" : "Play"}>
              <button
                type="button"
                disabled={actionsDisabled}
                onClick={playback.onToggle}
                aria-label={isPlaying ? "Pause" : "Play"}
                /* size-13 against the siblings' size-11: the primary action reads as primary
                   through size and fill, so it does not need a word as well. Fixed width also
                   drops the `min-w` that existed to stop Play/Pause/Loading jumping. */
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-neutral-900 shadow-lg shadow-black/30 transition-transform hover:scale-[1.05] active:scale-95 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40"
              >
                {isLoading ? (
                  <SpinnerSteps size={22} color="currentColor" />
                ) : isPlaying ? (
                  <PauseActiveIcon size={22} aria-hidden="true" />
                ) : (
                  <PlayActiveIcon size={22} aria-hidden="true" />
                )}
              </button>
            </Tooltip>
          ) : null}

          {onShuffle ? (
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={onShuffle}
              className={HERO_PILL}
            >
              <ShuffleActiveIcon size={18} aria-hidden="true" />
              Shuffle
            </button>
          ) : null}

          {loop ? (
            <Tooltip content={loopMode === "repeat-one" ? "Loop current song" : loopMode === "repeat-all" ? "Loop the whole playlist" : "Loop the whole playlist"}>
              <button
                type="button"
                disabled={actionsDisabled}
                onClick={isLooping && loop.onCycle ? loop.onCycle : loop.onPlay}
                aria-pressed={isLooping}
                aria-label={loopMode === "repeat-one" ? "Loop current song" : loopMode === "repeat-all" ? "Loop queue" : "Play in loop"}
                className={cn(
                  HERO_PILL,
                  isLooping && "bg-primary/25 text-primary ring-primary/60",
                )}
              >
                {loopMode === "repeat-one" ? (
                  <RepeatOneActiveIcon size={18} aria-hidden="true" />
                ) : (
                  <RepeatActiveIcon size={18} aria-hidden="true" />
                )}
                {loopMode === "repeat-one" ? "Loop one" : loopMode === "repeat-all" ? "Loop all" : "Loop"}
              </button>
            </Tooltip>
          ) : null}

          {onAddToPlaylist ? (
            <Tooltip content="Add every song here to a playlist">
              <button
                type="button"
                disabled={actionsDisabled}
                onClick={onAddToPlaylist}
                aria-label="Add to playlist"
                className={HERO_ICON_BUTTON}
              >
                <PlaylistAddIcon size={18} aria-hidden="true" />
              </button>
            </Tooltip>
          ) : null}

          {onAddToQueue ? (
            <Tooltip content="Add every song here to the queue">
              <button
                type="button"
                disabled={actionsDisabled}
                onClick={onAddToQueue}
                aria-label="Add to queue"
                className={HERO_ICON_BUTTON}
              >
                <ListIcon size={18} aria-hidden="true" />
              </button>
            </Tooltip>
          ) : null}

          {download ? (() => {
            /*
             * Disabled once everything here is already offline. Re-queueing downloaded tracks
             * would be a no-op the user cannot see, so the button says so instead of appearing
             * to do nothing.
             */
            const { allDownloaded, tooltip, label } = describeCollectionDownload(downloadCounts);

            return (
              <Tooltip content={tooltip}>
                <button
                  type="button"
                  disabled={actionsDisabled || allDownloaded || downloadBusy}
                  onClick={download.onStart}
                  aria-busy={downloadBusy}
                  aria-label={label}
                  className={cn(HERO_ICON_BUTTON, "relative")}
                >
                  {downloadBusy ? (
                    <SpinnerSteps size={18} color="currentColor" />
                  ) : allDownloaded ? (
                    <CheckIcon size={18} aria-hidden="true" className="text-primary" />
                  ) : (
                    <DownloadIcon size={18} aria-hidden="true" />
                  )}
                </button>
              </Tooltip>
            );
          })() : null}

          {actions}
        </div>
      </div>
    </header>
  );
}
