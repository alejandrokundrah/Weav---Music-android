import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { HeartActiveIcon, HeartIcon, PlayActiveIcon } from "@/ui/icons";
import type { Artist } from "../../datasource/types";
import { libraryController, playerController, searchController, tabManager, useLibraryState } from "../../player/playerStore";
import { SamplesController, useSamplesState } from "../../player/samples/AudioController";
import { SampleRecommendationService } from "../../player/samples/SampleRecommendationService";
import type { SampleItem } from "../../player/samples/types";
import { TrackArtwork } from "../components/TrackArtwork";
import { useTrackContextMenu } from "../components/TrackContextMenu";

/** Cards actually mounted either side of the active one; every other slot is an empty spacer. */
const MOUNT_RADIUS = 1;

interface SamplesPageProps {
  onOpenArtist: (artist: Artist) => void;
  /** Called after a full song has been started, so the host can bring up its player. */
  onOpenFullPlayer?: () => void;
}

/* One controller for the life of the app: leaving and returning resumes the same feed. */
let sharedController: SamplesController | null = null;
function getController(): SamplesController {
  sharedController ??= new SamplesController(
    new SampleRecommendationService(libraryController, searchController),
    playerController,
    () => tabManager.getActiveState(),
  );
  return sharedController;
}

/**
 * Samples: an immersive, vertically snapping feed of 30-second moments from songs the listener
 * has not necessarily heard.
 *
 * Only the controller makes sound. This component decides which card is visible and tells the
 * controller; cards never touch the player.
 */
export function SamplesPage({ onOpenArtist, onOpenFullPlayer }: SamplesPageProps) {
  const controller = getController();
  const { samples, activeIndex, loading, loadingMore, error } = useSamplesState(controller, (state) => ({
    samples: state.samples,
    activeIndex: state.activeIndex,
    loading: state.loading,
    loadingMore: state.loadingMore,
    error: state.error,
  }));
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [moreSample, setMoreSample] = useState<SampleItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  /* Start on open, silence on leave. Backgrounding the app counts as leaving. */
  useEffect(() => {
    void controller.loadSample();
    const onVisibility = () => {
      if (document.hidden) controller.stop();
      else void controller.loadSample();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      controller.stop();
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [controller]);

  /* Which card is on screen: the one more than 60% inside the scroller. */
  const slotRefs = useRef(new Map<number, HTMLElement>());
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || samples.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.6) continue;
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (!Number.isNaN(index)) controller.setActive(index);
        }
      },
      { root, threshold: [0.6] },
    );
    for (const element of slotRefs.current.values()) observer.observe(element);
    return () => observer.disconnect();
  }, [controller, samples.length]);

  /* The controller can move on by itself (a sample ends); bring the scroller along. */
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || root.clientHeight === 0) return;
    const target = activeIndex * root.clientHeight;
    if (Math.abs(root.scrollTop - target) > root.clientHeight * 0.4) {
      root.scrollTo({ top: target, behavior: "smooth" });
    }
  }, [activeIndex]);

  /* Keyboard: the arrows page, space toggles. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        controller.next();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        controller.previous();
      } else if (event.key === " " && !(target instanceof HTMLButtonElement)) {
        event.preventDefault();
        void controller.toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [controller]);

  const playFullSong = useCallback(
    (sample: SampleItem) => {
      controller.track("full_song_opened");
      controller.stop();
      void playerController.playTrackById(sample.songId, [sample.track], true);
      onOpenFullPlayer?.();
    },
    [controller, onOpenFullPlayer],
  );

  if (loading && samples.length === 0) return <SamplesSkeleton />;

  if (samples.length === 0) {
    return (
      <div className="font-lexend flex h-full flex-col items-center justify-center gap-4 px-8 text-center text-white">
        <p className="text-base font-light text-[#929292]">{error ?? "No samples are available right now."}</p>
        <button
          type="button"
          onClick={() => void controller.retry()}
          className="rounded-full bg-white px-6 py-3 text-sm font-medium text-[#131313] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="font-lexend relative h-full min-h-0 w-full overflow-hidden bg-[#131313] text-white">
      <div
        ref={scrollerRef}
        className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Samples"
        role="feed"
      >
        {samples.map((sample, index) => (
          <section
            key={sample.id}
            ref={(element) => {
              if (element) slotRefs.current.set(index, element);
              else slotRefs.current.delete(index);
            }}
            data-index={index}
            aria-label={`${sample.title} by ${sample.artist.name}`}
            aria-posinset={index + 1}
            aria-setsize={samples.length}
            className="h-full w-full snap-start snap-always"
          >
            {Math.abs(index - activeIndex) <= MOUNT_RADIUS ? (
              <SampleCard
                controller={controller}
                sample={sample}
                isActive={index === activeIndex}
                onOpenArtist={onOpenArtist}
                onPlayFull={playFullSong}
                onMore={setMoreSample}
                onNotify={showToast}
              />
            ) : null}
          </section>
        ))}
      </div>

      {loadingMore && (
        <div className="pointer-events-none absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-xs font-light text-white/80 backdrop-blur">
          <span className="size-2 animate-pulse rounded-full bg-white" /> Finding more
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-0 bottom-24 z-30 mx-auto w-fit max-w-[80%] rounded-full bg-white px-5 py-2.5 text-sm font-medium text-[#131313] shadow-lg"
        >
          {toast}
        </div>
      )}

      {moreSample && (
        <SampleMoreSheet
          controller={controller}
          sample={moreSample}
          onClose={() => setMoreSample(null)}
          onOpenArtist={onOpenArtist}
          onPlayFull={playFullSong}
          onNotify={showToast}
        />
      )}
    </div>
  );
}

/* ── Card ── */

function SampleCard({
  controller,
  sample,
  isActive,
  onOpenArtist,
  onPlayFull,
  onMore,
  onNotify,
}: {
  controller: SamplesController;
  sample: SampleItem;
  isActive: boolean;
  onOpenArtist: (artist: Artist) => void;
  onPlayFull: (sample: SampleItem) => void;
  onMore: (sample: SampleItem) => void;
  onNotify: (message: string) => void;
}) {
  const libraryState = useLibraryState();
  const { toggleTrackLike, openPlaylistPicker, openAlbumForTrack } = useTrackContextMenu();
  const isLiked = Boolean(libraryState.library?.likedSongs.some((track) => track.id === sample.songId));
  const isLikePending = libraryState.pendingLikeTrackIds.has(sample.songId);
  const canLike = sample.track.source !== "local";

  const handleLike = () => {
    controller.track(isLiked ? "sample_unliked" : "sample_liked");
    void toggleTrackLike(sample.track);
  };

  const handleShare = async () => {
    const url = `https://music.youtube.com/watch?v=${encodeURIComponent(sample.songId)}`;
    controller.track("sample_shared");
    try {
      if (navigator.share) {
        await navigator.share({ title: sample.title, text: `${sample.title} — ${sample.artist.name}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      onNotify("Link copied");
    } catch (error) {
      // Dismissing the share sheet rejects with AbortError; that is not a failure.
      if ((error as Error)?.name !== "AbortError") onNotify("Could not share this song");
    }
  };

  return (
    <article className="relative mx-auto flex h-full w-full max-w-[30rem] flex-col overflow-hidden md:my-0 md:rounded-[2rem]">
      {/* Ambient wash: a tiny copy of the cover, blown up and blurred, so any screen shape is filled. */}
      <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -inset-[20%] opacity-70 blur-[40px] saturate-150">
          <TrackArtwork className="size-full rounded-none" size={120} artworkUrl={sample.album.artworkUrl} iconSize={0} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#131313]/30 via-[#131313]/50 to-[#131313]" />
      </div>

      {/* The cover itself, square and as large as the width allows, so it stays sharp. */}
      <button
        type="button"
        onClick={() => void controller.toggle()}
        aria-label="Play or pause"
        className="relative z-10 mx-5 mt-[8vh] aspect-square shrink-0 overflow-hidden rounded-[2rem] bg-[#1b1b1b] shadow-[0_30px_80px_rgba(0,0,0,0.55)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50 md:mt-10"
      >
        <TrackArtwork
          className="size-full object-cover"
          size={512}
          artworkUrl={sample.album.artworkUrl}
          iconSize={72}
          loading={isActive ? "eager" : "lazy"}
        />
        {isActive && <PlayStateOverlay controller={controller} />}
      </button>

      <div className="relative z-10 mt-auto flex items-end gap-3 px-5 pb-6 pt-8">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="line-clamp-2 text-[26px] font-semibold leading-8 tracking-normal text-white xl:text-4xl xl:leading-10">
              {sample.title}
            </h2>
            <button
              type="button"
              onClick={() => onOpenArtist({ id: sample.artist.id ?? "", name: sample.artist.name })}
              className="w-fit max-w-full truncate text-left text-base font-normal text-[#e7e7e7] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 xl:text-xl"
            >
              {sample.artist.name}
            </button>
            {sample.album.name && (
              <button
                type="button"
                disabled={!openAlbumForTrack}
                onClick={() => openAlbumForTrack?.(sample.track)}
                className="w-fit max-w-full truncate text-left text-sm font-extralight text-[#bdbdbd] enabled:hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 xl:text-base"
              >
                {sample.album.name}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => onPlayFull(sample)}
            className="flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-[#131313] transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50 xl:px-7 xl:py-4 xl:text-lg"
          >
            <PlayActiveIcon size={18} aria-hidden="true" />
            Play full song
          </button>

          {isActive && <SampleProgress controller={controller} />}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-3">
          <ActionButton
            label={isLiked ? "Remove from liked songs" : "Like"}
            onPress={handleLike}
            disabled={!canLike || isLikePending}
            active={isLiked}
          >
            {isLiked ? <HeartActiveIcon size={26} /> : <HeartIcon size={26} />}
          </ActionButton>
          <ActionButton
            label="Add to playlist"
            onPress={() => {
              controller.track("sample_added_to_playlist");
              openPlaylistPicker(sample.track);
            }}
          >
            <PlusGlyph />
          </ActionButton>
          <ActionButton label="Share" onPress={() => void handleShare()}>
            <ShareGlyph />
          </ActionButton>
          <ActionButton label="More" onPress={() => onMore(sample)}>
            <MoreGlyph />
          </ActionButton>
        </div>
      </div>
    </article>
  );
}

/** Subscribed on its own so the card does not re-render five times a second. */
function PlayStateOverlay({ controller }: { controller: SamplesController }) {
  const { isPlaying, isBuffering } = useSamplesState(controller, (state) => ({
    isPlaying: state.isPlaying,
    isBuffering: state.isBuffering,
  }));
  if (isPlaying && !isBuffering) return null;
  return (
    <span className="absolute inset-0 grid place-items-center bg-black/35">
      {isBuffering ? (
        <span className="size-12 animate-spin rounded-full border-4 border-white/30 border-t-white" role="status" aria-label="Loading" />
      ) : (
        <span className="grid size-20 place-items-center rounded-full bg-white/90 text-[#131313]">
          <PlayActiveIcon size={36} aria-hidden="true" />
        </span>
      )}
    </span>
  );
}

function SampleProgress({ controller }: { controller: SamplesController }) {
  const { currentTime, duration } = useSamplesState(controller, (state) => ({
    currentTime: state.currentTime,
    duration: state.duration,
  }));
  const barRef = useRef<HTMLDivElement>(null);
  const fraction = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const seekFromPointer = (clientX: number) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    void controller.seek(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * duration);
  };

  return (
    <div
      ref={barRef}
      role="slider"
      tabIndex={0}
      aria-label="Sample position"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      onPointerDown={(event) => seekFromPointer(event.clientX)}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") void controller.seek(currentTime + 5);
        if (event.key === "ArrowLeft") void controller.seek(currentTime - 5);
      }}
      className="group relative h-6 w-full cursor-pointer touch-none focus-visible:outline-none"
    >
      <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/25 group-focus-visible:ring-2 group-focus-visible:ring-white/60">
        <span
          className="block h-full origin-left rounded-full bg-white transition-transform duration-200 ease-linear"
          style={{ transform: `scaleX(${fraction})` }}
        />
      </span>
    </div>
  );
}

function ActionButton({
  label,
  onPress,
  children,
  active = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active || undefined}
      className={cn(
        "grid size-12 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition-transform active:scale-90 disabled:opacity-40 xl:size-16",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50",
        active && "text-red-500",
      )}
    >
      {children}
    </button>
  );
}

/* ── "More" sheet ── */

function SampleMoreSheet({
  controller,
  sample,
  onClose,
  onOpenArtist,
  onPlayFull,
  onNotify,
}: {
  controller: SamplesController;
  sample: SampleItem;
  onClose: () => void;
  onOpenArtist: (artist: Artist) => void;
  onPlayFull: (sample: SampleItem) => void;
  onNotify: (message: string) => void;
}) {
  const { openAlbumForTrack } = useTrackContextMenu();
  const entries = useMemo(
    () => [
      { label: "Open song", run: () => onPlayFull(sample) },
      { label: "Open artist", run: () => onOpenArtist({ id: sample.artist.id ?? "", name: sample.artist.name }) },
      ...(openAlbumForTrack && sample.album.name
        ? [{ label: "Open album", run: () => openAlbumForTrack(sample.track) }]
        : []),
      {
        label: "Add to queue",
        run: () => {
          playerController.addToQueue(sample.track);
          controller.track("sample_added_to_queue");
          onNotify("Added to queue");
        },
      },
      {
        label: "Hide this song",
        run: () => {
          controller.hide(sample.songId);
          onNotify("We won't show this song again");
        },
      },
      {
        label: "Report",
        run: () => {
          controller.hide(sample.songId, "sample_reported");
          onNotify("Thanks, we've hidden it");
        },
      },
    ],
    [controller, onNotify, onOpenArtist, onPlayFull, openAlbumForTrack, sample],
  );

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More options"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[30rem] rounded-t-[2rem] bg-[#1b1b1b] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 animate-in slide-in-from-bottom duration-200"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/30" />
        <p className="truncate pb-3 text-center text-sm font-extralight text-[#929292]">
          {sample.title} · {sample.artist.name}
        </p>
        {entries.map((entry) => (
          <button
            key={entry.label}
            type="button"
            onClick={() => {
              onClose();
              entry.run();
            }}
            className="flex w-full items-center rounded-2xl px-3 py-3.5 text-left text-base font-light text-white active:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            {entry.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Loading ── */

function SamplesSkeleton() {
  return (
    <div className="font-lexend relative mx-auto flex h-full w-full max-w-[30rem] flex-col px-5 pb-8 pt-[8vh] text-white" role="status" aria-label="Loading Samples">
      <div className="aspect-square w-full animate-pulse rounded-[2rem] bg-[#1b1b1b]" />
      <div className="mt-auto flex flex-col gap-3">
        <div className="h-8 w-3/4 animate-pulse rounded-xl bg-[#1b1b1b]" />
        <div className="h-5 w-1/2 animate-pulse rounded-xl bg-[#1b1b1b]" />
        <div className="h-12 w-40 animate-pulse rounded-full bg-[#1b1b1b]" />
        <p className="pt-2 text-center text-sm font-light text-[#929292]">Loading Samples…</p>
      </div>
    </div>
  );
}

/* ── Glyphs ── */

function PlusGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ShareGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 15V3m0 0L8 7m4-4 4 4M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MoreGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5.5" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="18.5" r="1.6" fill="currentColor" />
    </svg>
  );
}
