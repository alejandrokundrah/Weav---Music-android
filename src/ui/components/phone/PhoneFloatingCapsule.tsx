import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn, formatMinutesSeconds } from "@/lib/utils";
import {
  ArrowUpIcon,
  CloseIcon,
  PauseActiveIcon,
  PlayActiveIcon,
  SkipNextIcon,
  SkipPreviousIcon,
} from "@/ui/icons";
import {
  playerController,
  shallowEqual,
  usePlayerSelector,
} from "../../../player/playerStore";
import { TrackArtwork } from "../TrackArtwork";

interface PhoneFloatingCapsuleProps {
  onOpenFullPlayer: () => void;
}

const STORAGE_KEY_POS = "phone-capsule-pos";
const COLLAPSED_WIDTH = 184;
const COLLAPSED_HEIGHT = 48;
const EXPANDED_WIDTH = 296;
const EXPANDED_HEIGHT = 98;

/**
 * Floating morphing capsule for phone:
 * - Appears when music is playing and full player is closed (or when user tabs away)
 * - Draggable anywhere on the screen with touch/pointer
 * - Hover (or tap on phone) to smoothly morph and expand
 * - Album-reactive blurred glass backdrop with specular edge
 * - Interactive transport controls & live seek bar in expanded state
 * - Fullscreen button to expand into full player
 */
export function PhoneFloatingCapsule({ onOpenFullPlayer }: PhoneFloatingCapsuleProps) {
  const state = usePlayerSelector(
    (player) => ({
      currentTrack: player.currentTrack,
      status: player.status,
    }),
    shallowEqual,
  );

  const track = state.currentTrack;
  const isPlaying = state.status === "playing";
  const isLoading = state.status === "loading";

  const [expanded, setExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  /**
   * Visibility gating: The capsule only appears when the user returns
   * from having the app in the background. It stays hidden while the
   * user is actively inside the app.
   */
  const [wasBackgrounded, setWasBackgrounded] = useState(false);
  const [showCapsule, setShowCapsule] = useState(false);
  const autoHideTimerRef = useRef<number | null>(null);

  // Position state with safe defaults
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_POS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          return parsed;
        }
      }
    } catch {}
    const defaultX = typeof window !== "undefined" ? Math.max(16, window.innerWidth - COLLAPSED_WIDTH - 16) : 16;
    const defaultY = typeof window !== "undefined" ? Math.max(80, window.innerHeight - 170) : 400;
    return { x: defaultX, y: defaultY };
  });

  // Dragging state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  // Un-dismiss when track changes
  useEffect(() => {
    if (track) setIsDismissed(false);
  }, [track?.id]);

  // Track elapsed playback position
  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      setCurrentTime(playerController.getCurrentTime());
    }, 250);
    return () => window.clearInterval(interval);
  }, [isPlaying]);

  // Visibility change: detect when app goes to background and comes back
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        // App just went to background
        setWasBackgrounded(true);
      } else if (document.visibilityState === "visible" && wasBackgrounded) {
        // User is back from background — show the capsule
        if (track && (isPlaying || isLoading)) {
          setIsDismissed(false);
          setShowCapsule(true);

          // Auto-hide after 8 seconds
          if (autoHideTimerRef.current) window.clearTimeout(autoHideTimerRef.current);
          autoHideTimerRef.current = window.setTimeout(() => {
            setShowCapsule(false);
            setExpanded(false);
          }, 8000);
        }
        setWasBackgrounded(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (autoHideTimerRef.current) window.clearTimeout(autoHideTimerRef.current);
    };
  }, [wasBackgrounded, track, isPlaying, isLoading]);

  // Save position on change
  const savePosition = (nextPos: { x: number; y: number }) => {
    setPos(nextPos);
    try {
      localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(nextPos));
    } catch {}
  };

  // Only render when returning from background with active playback
  if (!track || isDismissed || !showCapsule) return null;

  const currentWidth = expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;
  const currentHeight = expanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT;

  // Pointer drag handlers
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Only drag on primary button/touch, and not on interactive buttons/inputs
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) {
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: pos.x,
      initialY: pos.y,
    };
    isDraggingRef.current = false;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    if (!isDraggingRef.current && (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4)) {
      isDraggingRef.current = true;
    }

    if (isDraggingRef.current) {
      const minX = 10;
      const maxX = Math.max(10, window.innerWidth - currentWidth - 10);
      const minY = 60;
      const maxY = Math.max(60, window.innerHeight - currentHeight - 75);

      const nextX = Math.min(Math.max(minX, dragStartRef.current.initialX + deltaX), maxX);
      const nextY = Math.min(Math.max(minY, dragStartRef.current.initialY + deltaY), maxY);

      setPos({ x: nextX, y: nextY });
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const wasDragging = isDraggingRef.current;
    dragStartRef.current = null;
    isDraggingRef.current = false;

    if (wasDragging) {
      savePosition(pos);
    } else {
      // Tap detected on the body of the capsule -> toggle expand on phone!
      setExpanded((prev) => !prev);
    }
  };

  // Hover handlers for mouse/stylus
  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    setExpanded(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(() => {
      setExpanded(false);
    }, 400);
  };

  const durationSec = track.durationSec || 1;
  const progressRatio = Math.min(1, Math.max(0, currentTime / durationSec));

  return (
    <div
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        touchAction: "none",
      }}
      className="fixed z-40 select-none animate-in fade-in zoom-in-95 duration-200"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Morphing Capsule Container */}
      <div
        className={cn(
          "relative flex flex-col overflow-hidden",
          "bg-[#151515]/90 backdrop-blur-2xl ring-1 ring-white/15",
          "shadow-[0_12px_36px_rgba(0,0,0,0.65),0_2px_8px_rgba(0,0,0,0.4)]",
          "transition-[height,width,border-radius,padding,background-color] duration-300",
          "[transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
          expanded ? "p-2.5 rounded-2xl bg-[#141414]/95 ring-white/20" : "p-1.5 rounded-full",
        )}
        style={{
          width: `${currentWidth}px`,
          height: `${currentHeight}px`,
        }}
      >
        {/* Album-Reactive Blurred Backdrop */}
        {track.artworkUrl && (
          <span
            className="pointer-events-none absolute inset-0 -z-10 scale-150 bg-cover bg-center opacity-30 blur-2xl"
            style={{ backgroundImage: `url("${track.artworkUrl}")` }}
            aria-hidden="true"
          />
        )}

        {/* Specular Top Glass Edge */}
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
          aria-hidden="true"
        />

        {/* ── Row 1: Identity & Quick Actions ── */}
        <div className="flex h-9 shrink-0 items-center gap-2">
          {/* Artwork circle: click opens full player */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowCapsule(false);
              if (autoHideTimerRef.current) window.clearTimeout(autoHideTimerRef.current);
              onOpenFullPlayer();
            }}
            aria-label="Open full player"
            className="group relative size-9 shrink-0 overflow-hidden rounded-full ring-1 ring-white/20 focus-visible:outline-none"
          >
            <TrackArtwork
              className={cn(
                "size-full object-cover transition-transform",
                isPlaying && "animate-[spin_12s_linear_infinite]",
              )}
              size={36}
              artworkUrl={track.artworkUrl}
              iconSize={16}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
              <ArrowUpIcon size={14} className="text-white" />
            </div>
          </button>

          {/* Song Info */}
          <div
            className="flex min-w-0 flex-1 cursor-pointer flex-col justify-center"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((prev) => !prev);
            }}
          >
            <span className="truncate text-xs font-semibold leading-tight text-white">
              {track.title}
            </span>
            <span className="truncate text-[10px] font-light leading-tight text-[#929292]">
              {track.artist}
            </span>
          </div>

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-1">
            {!expanded ? (
              /* Quick Play/Pause button when collapsed */
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void playerController.togglePlayPause();
                }}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="flex size-7 items-center justify-center rounded-full bg-white text-[#131313] transition-transform active:scale-90"
              >
                {isPlaying ? <PauseActiveIcon size={14} /> : <PlayActiveIcon size={14} />}
              </button>
            ) : (
              /* Expanded Header buttons: Expand to full player & Dismiss */
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCapsule(false);
                    if (autoHideTimerRef.current) window.clearTimeout(autoHideTimerRef.current);
                    onOpenFullPlayer();
                  }}
                  aria-label="Expand to full screen"
                  className="flex size-7 items-center justify-center rounded-full bg-[#252525] text-white transition-transform active:scale-90 hover:bg-[#303030]"
                >
                  <ArrowUpIcon size={13} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDismissed(true);
                    setShowCapsule(false);
                    if (autoHideTimerRef.current) window.clearTimeout(autoHideTimerRef.current);
                  }}
                  aria-label="Close floating mini player"
                  className="flex size-7 items-center justify-center rounded-full bg-[#252525] text-[#929292] transition-transform active:scale-90 hover:text-white"
                >
                  <CloseIcon size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Row 2: Transport & Seek (Revealed when expanded) ── */}
        {expanded && (
          <div className="mt-2.5 flex flex-col gap-1.5 animate-in fade-in duration-200">
            {/* Seek Bar */}
            <div className="flex items-center gap-2">
              <span className="w-7 text-right text-[9px] tabular-nums text-[#727272]">
                {formatMinutesSeconds(currentTime)}
              </span>
              <div
                className="group relative flex h-3 flex-1 cursor-pointer items-center"
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  void playerController.seekTo(ratio * durationSec);
                  setCurrentTime(ratio * durationSec);
                }}
              >
                <div className="h-1 w-full rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-[#cfe86a] transition-[width] duration-100"
                    style={{ width: `${progressRatio * 100}%` }}
                  />
                </div>
              </div>
              <span className="w-7 text-left text-[9px] tabular-nums text-[#727272]">
                {formatMinutesSeconds(durationSec)}
              </span>
            </div>

            {/* Transport controls */}
            <div className="flex items-center justify-center gap-4 pt-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void playerController.skipToPrevious();
                }}
                aria-label="Previous track"
                className="flex size-7 items-center justify-center rounded-full text-[#929292] transition-transform active:scale-90 hover:text-white"
              >
                <SkipPreviousIcon size={16} />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void playerController.togglePlayPause();
                }}
                disabled={isLoading}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="flex size-8 items-center justify-center rounded-full bg-white text-[#131313] transition-transform active:scale-90"
              >
                {isPlaying ? <PauseActiveIcon size={16} /> : <PlayActiveIcon size={16} />}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void playerController.skipToNext();
                }}
                aria-label="Next track"
                className="flex size-7 items-center justify-center rounded-full text-[#929292] transition-transform active:scale-90 hover:text-white"
              >
                <SkipNextIcon size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
