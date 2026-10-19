import { lazy, Suspense, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { cn, formatMinutesSeconds } from "@/lib/utils";
import { SpinnerSteps } from "@/components/motion/loader";
import {
  CheckActiveIcon,
  ChevronDownIcon,
  DownloadIcon,
  HeartActiveIcon,
  HeartIcon,
  LyricsActiveIcon,
  LyricsIcon,
  PauseActiveIcon,
  PlayActiveIcon,
  QueuePanelIcon,
  SkipNextActiveIcon,
  SkipPreviousActiveIcon,
  SpeedIcon,
} from "@/ui/icons";
import type { Track } from "../../../datasource/types";
import {
  playerController,
  shallowEqual,
  useLibraryState,
  usePlayerSelector,
  usePlayerSessionSelector,
} from "../../../player/playerStore";
import type { PlayerSession } from "../../../player/PlayerController";
import {
  cancelDownload,
  queueDownload,
  removeDownload,
  useOfflineState,
} from "../../../player/offlineStore";
import { TrackArtwork } from "../TrackArtwork";
import { useTrackContextMenu } from "../TrackContextMenu";
import { SeekBar } from "./SeekBar";
import { PhoneQueue } from "./PhoneQueue";

const LyricsView = lazy(() =>
  import("../../pages/LyricsView").then((m) => ({ default: m.LyricsView })),
);

interface NowPlayingScreenProps {
  onClose: () => void;
}

const EMPTY_QUEUE: Track[] = [];

function selectNeighbours(session: PlayerSession | null) {
  return { queue: session?.queue ?? EMPTY_QUEUE, queueIndex: session?.queueIndex ?? -1 };
}

function neighboursEqual(
  a: ReturnType<typeof selectNeighbours>,
  b: ReturnType<typeof selectNeighbours>,
) {
  return a.queue === b.queue && a.queueIndex === b.queueIndex;
}

/** How far a swipe has to travel before it counts, in CSS pixels. */
const SWIPE_DISTANCE = 64;

/** Offered speeds for quick selection on mobile. */
const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

/** Sleep durations in minutes. */
const SLEEP_MINUTES = [15, 30, 45, 60, 90] as const;

const RING_RADIUS = 8;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({ progress }: { progress: number }) {
  const filled = Math.min(1, Math.max(0, progress / 100));
  return (
    <svg viewBox="0 0 20 20" className="size-[20px] -rotate-90" aria-hidden="true">
      <circle
        cx="10"
        cy="10"
        r={RING_RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="text-[#333333]"
      />
      <circle
        cx="10"
        cy="10"
        r={RING_RADIUS}
        fill="none"
        stroke="#cfe86a"
        strokeWidth={2}
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={RING_CIRCUMFERENCE * (1 - filled)}
        strokeLinecap="round"
        className="transition-[stroke-dashoffset] duration-150"
      />
    </svg>
  );
}

/**
 * The phone's full-screen player:
 * - Top header with close chevron, drag handle, and quick queue button
 * - Cover carousel with swipe-to-skip
 * - Title and artist display
 * - Mobile action bar: Like, Download (with offline progress), Playback Speed, and Queue
 * - Arc-shaped progress line and transport controls
 * - Built-in slide-up Queue sheet & Playback speed/sleep timer sheet
 */
export function NowPlayingScreen({ onClose }: NowPlayingScreenProps) {
  const state = usePlayerSelector(
    (player) => ({
      currentTrack: player.currentTrack,
      status: player.status,
      history: player.history,
    }),
    shallowEqual,
  );
  const { queue, queueIndex } = usePlayerSessionSelector(selectNeighbours, neighboursEqual);
  const libraryState = useLibraryState();
  const { toggleTrackLike } = useTrackContextMenu();
  const offline = useOfflineState();

  const track = state.currentTrack;
  const isBusy = state.status === "loading";
  const isPlaying = state.status === "playing";

  const previousTrack: Track | undefined =
    (queueIndex > 0 ? queue[queueIndex - 1] : undefined)
    ?? state.history[state.history.length - 1];
  const nextTrack: Track | undefined = queueIndex >= 0 ? queue[queueIndex + 1] : undefined;

  const canLike = Boolean(track) && track?.source !== "local";
  const isLiked = Boolean(
    track && libraryState.library?.likedSongs.some((liked) => liked.id === track.id),
  );
  const isLikePending = Boolean(track && libraryState.pendingLikeTrackIds.has(track.id));

  // Offline download state
  const isDownloaded = Boolean(track && offline.entries[track.id]);
  const isDownloading = Boolean(track && offline.downloadingId === track.id);
  const queuePosition = track ? offline.queued.indexOf(track.id) : -1;
  const isDownloadQueued = queuePosition >= 0;
  const downloadProgress = isDownloading ? offline.progress : null;

  const handleDownloadClick = () => {
    if (!track || track.source === "local") return;
    if (isDownloaded) void removeDownload(track.id);
    else if (isDownloading || isDownloadQueued) cancelDownload(track.id);
    else queueDownload(track);
  };

  // Queue Sheet state
  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const upcomingCount = Math.max(0, queue.length - 1 - queueIndex);

  // Speed & Sleep timer state
  const [showSpeedSheet, setShowSpeedSheet] = useState(false);
  const [rate, setRate] = useState(() => playerController.getPlaybackRate());
  const [sleepRemainingMs, setSleepRemainingMs] = useState<number | null>(() =>
    playerController.getSleepTimerRemainingMs(),
  );

  const isSleeping = sleepRemainingMs !== null;

  useEffect(() => {
    if (!isSleeping) return;
    const tick = () => setSleepRemainingMs(playerController.getSleepTimerRemainingMs());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [isSleeping]);

  const applyRate = (next: number) => {
    playerController.setPlaybackRate(next);
    setRate(playerController.getPlaybackRate());
  };

  const applySleep = (minutes: number | null) => {
    playerController.setSleepTimer(minutes);
    setSleepRemainingMs(playerController.getSleepTimerRemainingMs());
  };

  // Horizontal drag on the cover carousel
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  // Vertical drag on the handle strip
  const sheetStart = useRef<number | null>(null);

  const onCarouselDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { x: event.clientX, y: event.clientY };
    setIsDragging(true);
  };
  const onCarouselMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    setDragX(event.clientX - dragStart.current.x);
  };
  const onCarouselUp = () => {
    const distance = dragX;
    dragStart.current = null;
    setIsDragging(false);
    setDragX(0);
    if (distance <= -SWIPE_DISTANCE && nextTrack) void playerController.skipToNext();
    else if (distance >= SWIPE_DISTANCE) void playerController.skipToPrevious();
  };

  const onHandleDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    sheetStart.current = event.clientY;
  };
  const onHandleUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = sheetStart.current;
    sheetStart.current = null;
    if (start === null || event.clientY - start > -8) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#131313] text-white">
      {/* Top Bar with Dismiss Chevron, Handle, and Quick Queue Button */}
      <div className="flex h-14 shrink-0 items-center justify-between px-5 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close player"
          className="flex size-10 items-center justify-center rounded-full text-[#a0a0a0] transition-transform active:scale-90 hover:text-white focus-visible:outline-none"
        >
          <ChevronDownIcon size={24} />
        </button>

        <div
          role="button"
          tabIndex={0}
          aria-label="Close player"
          onPointerDown={onHandleDown}
          onPointerUp={onHandleUp}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") onClose();
          }}
          className="flex h-full cursor-pointer touch-none items-center justify-center px-4 focus-visible:outline-none"
        >
          <span className="h-[5px] w-12 rounded-full bg-[#2e2e2e]" />
        </div>

        <button
          type="button"
          onClick={() => setShowQueue(true)}
          aria-label="Open queue"
          className={cn(
            "relative flex size-10 items-center justify-center rounded-full text-[#a0a0a0] transition-transform active:scale-90 hover:text-white focus-visible:outline-none",
            upcomingCount > 0 && "text-[#cfe86a]",
          )}
        >
          <QueuePanelIcon size={20} />
          {upcomingCount > 0 && (
            <span className="absolute right-1 top-1 flex size-3.5 items-center justify-center rounded-full bg-[#cfe86a] text-[8px] font-bold text-[#131313]">
              {upcomingCount > 9 ? "9+" : upcomingCount}
            </span>
          )}
        </button>
      </div>

      {/* Cover Carousel */}
      <div
        className="relative mx-auto mt-2 aspect-[260/282] h-[min(270px,32dvh)] shrink-0 touch-pan-y"
        onPointerDown={onCarouselDown}
        onPointerMove={onCarouselMove}
        onPointerUp={onCarouselUp}
        onPointerCancel={onCarouselUp}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `translateX(${dragX}px)`,
            transition: isDragging ? "none" : "transform 220ms ease-out",
          }}
        >
          {/* Neighbours: half-faded */}
          <div
            aria-hidden="true"
            className="absolute right-[calc(100%+24px)] top-1/2 aspect-[218/240] h-[85%] -translate-y-1/2 overflow-hidden rounded-[36px] bg-[#1b1b1b] opacity-40"
          >
            {previousTrack && (
              <TrackArtwork
                className="size-full object-cover"
                size={256}
                artworkUrl={previousTrack.artworkUrl}
                iconSize={32}
              />
            )}
          </div>
          <div
            aria-hidden="true"
            className="absolute left-[calc(100%+24px)] top-1/2 aspect-[227/240] h-[85%] -translate-y-1/2 overflow-hidden rounded-[36px] bg-[#1b1b1b] opacity-40"
          >
            {nextTrack && (
              <TrackArtwork
                className="size-full object-cover"
                size={256}
                artworkUrl={nextTrack.artworkUrl}
                iconSize={32}
              />
            )}
          </div>

          <div className="absolute inset-0 overflow-hidden rounded-[32px] bg-[#1b1b1b] shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            {track && (
              <TrackArtwork
                className="size-full object-cover"
                size={512}
                artworkUrl={track.artworkUrl}
                iconSize={72}
                loading="eager"
              />
            )}
          </div>
        </div>
      </div>

      {/* Track Info (Title, Artist) */}
      <div className="mt-[clamp(1rem,3.5dvh,2rem)] flex shrink-0 flex-col items-center px-6 text-center">
        <p className="w-full truncate text-2xl font-semibold leading-tight text-white">
          {track?.title ?? "Nothing playing"}
        </p>
        <p className="mt-1.5 w-full truncate text-sm font-light leading-tight text-[#929292]">
          {track ? (track.artist || track.artists?.map((artist) => artist.name).join(", ")) : ""}
        </p>

        {/* Mobile Action Bar: Like, Download, Speed, Queue */}
        <div className="mt-5 flex w-full max-w-[340px] items-center justify-around px-2">
          {/* 1. Like Button */}
          <button
            type="button"
            onClick={() => track && void toggleTrackLike(track)}
            disabled={!canLike || isLikePending}
            aria-pressed={isLiked}
            aria-label={isLiked ? "Remove from liked songs" : "Add to liked songs"}
            className="group flex flex-col items-center gap-1.5 focus-visible:outline-none disabled:opacity-40"
          >
            <div
              className={cn(
                "flex size-11 items-center justify-center rounded-full transition-all active:scale-90",
                isLiked
                  ? "bg-red-500/15 text-red-500 ring-1 ring-red-500/30"
                  : "bg-[#1b1b1b] text-[#a0a0a0] hover:text-white",
              )}
            >
              {isLiked ? <HeartActiveIcon size={22} /> : <HeartIcon size={22} />}
            </div>
            <span
              className={cn(
                "text-[10px] font-medium tracking-tight",
                isLiked ? "text-red-400" : "text-[#727272]",
              )}
            >
              {isLiked ? "Liked" : "Like"}
            </span>
          </button>

          {/* 2. Download Button */}
          <button
            type="button"
            onClick={handleDownloadClick}
            disabled={!track || track.source === "local"}
            aria-label={
              isDownloaded
                ? "Remove offline download"
                : isDownloading
                  ? "Cancel download"
                  : "Download track for offline"
            }
            className="group flex flex-col items-center gap-1.5 focus-visible:outline-none disabled:opacity-30"
          >
            <div
              className={cn(
                "flex size-11 items-center justify-center rounded-full transition-all active:scale-90",
                isDownloaded
                  ? "bg-[#cfe86a]/15 text-[#cfe86a] ring-1 ring-[#cfe86a]/40"
                  : isDownloading
                    ? "bg-[#cfe86a]/15 text-[#cfe86a]"
                    : "bg-[#1b1b1b] text-[#a0a0a0] hover:text-white",
              )}
            >
              {isDownloaded ? (
                <CheckActiveIcon size={22} />
              ) : isDownloading && downloadProgress !== null ? (
                <ProgressRing progress={downloadProgress} />
              ) : isDownloading ? (
                <SpinnerSteps size={20} />
              ) : (
                <DownloadIcon
                  size={22}
                  className={cn(isDownloadQueued && "animate-pulse text-[#cfe86a]")}
                />
              )}
            </div>
            <span
              className={cn(
                "text-[10px] font-medium tracking-tight",
                isDownloaded || isDownloading ? "text-[#cfe86a]" : "text-[#727272]",
              )}
            >
              {isDownloaded
                ? "Saved"
                : isDownloading
                  ? downloadProgress !== null
                    ? `${Math.round(downloadProgress)}%`
                    : "Saving"
                  : isDownloadQueued
                    ? "Queued"
                    : "Download"}
            </span>
          </button>

          {/* 3. Playback Speed Button */}
          <button
            type="button"
            onClick={() => setShowSpeedSheet(true)}
            aria-label={`Playback speed: ${rate}x`}
            className="group flex flex-col items-center gap-1.5 focus-visible:outline-none"
          >
            <div
              className={cn(
                "flex size-11 items-center justify-center rounded-full transition-all active:scale-90",
                rate !== 1 || isSleeping
                  ? "bg-[#cfe86a]/15 text-[#cfe86a] ring-1 ring-[#cfe86a]/40"
                  : "bg-[#1b1b1b] text-[#a0a0a0] hover:text-white",
              )}
            >
              {rate !== 1 ? (
                <span className="text-xs font-bold tabular-nums">{rate}&times;</span>
              ) : (
                <SpeedIcon size={22} />
              )}
            </div>
            <span
              className={cn(
                "text-[10px] font-medium tracking-tight",
                rate !== 1 || isSleeping ? "text-[#cfe86a]" : "text-[#727272]",
              )}
            >
              {isSleeping
                ? formatMinutesSeconds(Math.ceil((sleepRemainingMs ?? 0) / 1000))
                : `${rate}\u00d7 Speed`}
            </span>
          </button>

          {/* 4. Lyrics Button */}
          <button
            type="button"
            onClick={() => setShowLyrics(true)}
            disabled={!track}
            aria-label="Open lyrics"
            className="group flex flex-col items-center gap-1.5 focus-visible:outline-none disabled:opacity-40"
          >
            <div className="flex size-11 items-center justify-center rounded-full bg-[#1b1b1b] text-[#a0a0a0] transition-all hover:text-white active:scale-90">
              {showLyrics ? <LyricsActiveIcon size={22} /> : <LyricsIcon size={22} />}
            </div>
            <span className="text-[10px] font-medium tracking-tight text-[#e7e7e7]">Lyrics</span>
          </button>

          {/* 5. Queue Button */}
          <button
            type="button"
            onClick={() => setShowQueue(true)}
            aria-label="Open playback queue"
            className="group flex flex-col items-center gap-1.5 focus-visible:outline-none"
          >
            <div
              className={cn(
                "relative flex size-11 items-center justify-center rounded-full transition-all active:scale-90",
                showQueue
                  ? "bg-[#cfe86a] text-[#131313]"
                  : "bg-[#1b1b1b] text-[#a0a0a0] hover:text-white",
              )}
            >
              <QueuePanelIcon size={22} />
              {upcomingCount > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#cfe86a] text-[9px] font-bold text-[#131313]">
                  {upcomingCount > 99 ? "99+" : upcomingCount}
                </span>
              )}
            </div>
            <span
              className={cn(
                "text-[10px] font-medium tracking-tight",
                upcomingCount > 0 ? "text-[#e7e7e7]" : "text-[#727272]",
              )}
            >
              Queue
            </span>
          </button>
        </div>
      </div>

      {/* Arc Progress and Transport Controls */}
      <div className="mt-auto shrink-0 pb-[env(safe-area-inset-bottom)]">
        <div className="relative aspect-[375/222] w-full">
          <SeekBar variant="arc" />

          <button
            type="button"
            onClick={() => void playerController.skipToPrevious()}
            disabled={!track}
            aria-label="Previous track"
            className="absolute left-[26.7%] top-[63%] flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[#d9d9d9] transition-transform active:scale-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <SkipPreviousActiveIcon size={24} />
          </button>

          <button
            type="button"
            onClick={() => void playerController.togglePlayPause()}
            disabled={isBusy || !track}
            aria-label={isBusy ? "Loading song" : isPlaying ? "Pause" : "Play"}
            className={cn(
              "absolute left-1/2 top-[63%] flex size-[66px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#191919] text-[#d0d0d0]",
              "shadow-[0_10px_50px_rgba(0,0,0,0.25),inset_0_4px_7px_rgba(176,176,176,0.05)]",
              "transition-transform active:scale-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
            )}
          >
            {isPlaying ? <PauseActiveIcon size={26} /> : <PlayActiveIcon size={26} />}
          </button>

          <button
            type="button"
            onClick={() => void playerController.skipToNext()}
            disabled={!track}
            aria-label="Next track"
            className="absolute left-[73%] top-[63%] flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[#d9d9d9] transition-transform active:scale-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <SkipNextActiveIcon size={24} />
          </button>
        </div>
      </div>

      {/* Lyrics sheet: the same synced lyrics view the desktop uses. */}
      {showLyrics && (
        <div className="font-lexend fixed inset-0 z-[60] bg-[#131313] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-in fade-in slide-in-from-bottom duration-200">
          <Suspense fallback={null}>
            <LyricsView onClose={() => setShowLyrics(false)} />
          </Suspense>
        </div>
      )}

      {/* Slide-up Queue Sheet */}
      {showQueue && <PhoneQueue onClose={() => setShowQueue(false)} />}

      {/* Speed & Sleep Timer Bottom Sheet */}
      {showSpeedSheet && (
        <div
          className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowSpeedSheet(false)}
        >
          <div
            className="flex flex-col gap-5 rounded-t-3xl bg-[#1b1b1b] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-250"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-full bg-[#252525] text-[#cfe86a]">
                  <SpeedIcon size={20} />
                </span>
                <span className="text-base font-semibold text-white">Playback Options</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSpeedSheet(false)}
                className="rounded-full bg-[#252525] px-3 py-1 text-xs text-[#929292] hover:text-white"
              >
                Done
              </button>
            </div>

            {/* Playback Speed */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-[#929292]">Playback Speed</span>
              <div className="grid grid-cols-5 gap-2">
                {SPEEDS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => applyRate(value)}
                    className={cn(
                      "flex h-11 items-center justify-center rounded-2xl text-xs font-semibold tabular-nums transition-transform active:scale-95",
                      rate === value
                        ? "bg-[#cfe86a] text-[#131313] shadow-md"
                        : "bg-[#252525] text-[#e7e7e7] hover:bg-[#2c2c2c]",
                    )}
                  >
                    {value}&times;
                  </button>
                ))}
              </div>
            </div>

            {/* Sleep Timer */}
            <div className="flex flex-col gap-2 border-t border-[#252525] pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#929292]">Sleep Timer</span>
                {isSleeping && (
                  <span className="text-xs font-semibold tabular-nums text-[#cfe86a]">
                    {formatMinutesSeconds(Math.ceil((sleepRemainingMs ?? 0) / 1000))} remaining
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {SLEEP_MINUTES.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => applySleep(minutes)}
                    className="rounded-full bg-[#252525] px-3.5 py-2 text-xs font-medium text-[#e7e7e7] transition-transform active:scale-95 hover:bg-[#2c2c2c]"
                  >
                    {minutes}m
                  </button>
                ))}
                {isSleeping && (
                  <button
                    type="button"
                    onClick={() => applySleep(null)}
                    className="rounded-full bg-red-500/15 px-3.5 py-2 text-xs font-medium text-red-400 transition-transform active:scale-95"
                  >
                    Turn off
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
