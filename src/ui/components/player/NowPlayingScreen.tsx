import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import {
  HeartActiveIcon,
  HeartIcon,
  PauseActiveIcon,
  PlayActiveIcon,
  SkipNextActiveIcon,
  SkipPreviousActiveIcon,
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
import { TrackArtwork } from "../TrackArtwork";
import { useTrackContextMenu } from "../TrackContextMenu";
import { SeekBar } from "./SeekBar";

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

/**
 * The phone's full-screen player, laid out on the 375 x 812 design canvas: a drag handle, a
 * cover carousel with the neighbouring songs peeking in from either side, title and artist,
 * a heart, and an arc-shaped progress line above the transport.
 *
 * Swipe the cover sideways to skip, drag the handle (or the screen) down to close.
 * Everything shown is read from the same player store the desktop bar uses.
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

  // Horizontal drag on the cover carousel.
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  // Vertical drag on the handle strip.
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
    // A tap or a downward drag both close it.
    if (start === null || event.clientY - start > -8) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#131313] text-white">
      {/* Drag handle */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Close player"
        onPointerDown={onHandleDown}
        onPointerUp={onHandleUp}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onClose();
        }}
        className="flex h-14 shrink-0 cursor-pointer touch-none items-end justify-center pb-2 pt-[env(safe-area-inset-top)] focus-visible:outline-none"
      >
        <span className="h-[7px] w-[69px] rounded-full bg-[#2e2e2e]" />
      </div>

      {/* Cover carousel */}
      <div
        className="relative mx-auto mt-3 aspect-[260/282] h-[min(282px,34dvh)] shrink-0 touch-pan-y"
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
          {/* Neighbours: half-faded, cropped by the screen edge, a 28px gap from the cover. */}
          <div
            aria-hidden="true"
            className="absolute right-[calc(100%+28px)] top-1/2 aspect-[218/240] h-[85%] -translate-y-1/2 overflow-hidden rounded-[42px] bg-[#1b1b1b] opacity-50"
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
            className="absolute left-[calc(100%+28px)] top-1/2 aspect-[227/240] h-[85%] -translate-y-1/2 overflow-hidden rounded-[42px] bg-[#1b1b1b] opacity-50"
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

          <div className="absolute inset-0 overflow-hidden rounded-[32px] bg-[#1b1b1b] shadow-[0_20px_60px_rgba(244,153,150,0.15)]">
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

      {/* Title, artist, heart */}
      <div className="mt-[clamp(1.5rem,6.5dvh,3.5rem)] flex shrink-0 flex-col items-center px-8 text-center">
        <p className="w-full truncate text-2xl font-semibold leading-tight">
          {track?.title ?? "Nothing playing"}
        </p>
        <p className="mt-2 w-full truncate text-xl font-light leading-tight">
          {track ? (track.artist || track.artists?.map((artist) => artist.name).join(", ")) : ""}
        </p>
        <button
          type="button"
          onClick={() => track && void toggleTrackLike(track)}
          disabled={!canLike || isLikePending}
          aria-pressed={isLiked}
          aria-label={isLiked ? "Remove from liked songs" : "Add to liked songs"}
          className="mt-6 flex size-12 items-center justify-center rounded-full text-white transition-transform active:scale-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          style={{ filter: "drop-shadow(0 4px 12px rgba(255,255,255,0.35))" }}
        >
          {isLiked ? <HeartActiveIcon size={26} /> : <HeartIcon size={26} />}
        </button>
      </div>

      {/* Arc progress and the transport, on the 375 x 222 bottom crop of the design. */}
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
    </div>
  );
}
