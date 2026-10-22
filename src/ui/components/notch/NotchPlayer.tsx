import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { PhysicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import {
  currentMonitor,
  getCurrentWindow,
  primaryMonitor,
} from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { motion } from "motion/react";
import { useMiniPlayerBridge } from "../mini-player/useMiniPlayerBridge";
import { cn, formatMinutesSeconds } from "@/lib/utils";
import { SpinnerSteps } from "@/components/motion/loader";
import {
  MusicNoteIcon,
  PauseActiveIcon,
  PlayActiveIcon,
  SkipNextIcon,
  SkipPreviousIcon,
} from "@/ui/icons";
import { TrackArtwork } from "../TrackArtwork";
import { NOTCH_SIZES, type NotchSizeKey } from "../../settings/notch";
import { useReduceMotion } from "../../settings/renderEffects";
import { findActiveLineIndex } from "../../pages/lyricsTiming";
import type { NotchLyricsSync } from "./NotchBridge";

const win = getCurrentWindow();

/** How long the notch stays open after a new song starts, before it folds back to a pill. */
const PEEK_MS = 4500;
/** Pointer-leave grace, so a slip off the edge does not collapse it under the cursor. */
const LEAVE_GRACE_MS = 350;
/** Roughly the spring's settling time; the window shrinks only after the shape has. */
const COLLAPSE_SETTLE_MS = 340;

type Shape = "pill" | "open";

/** A stable empty list, so "no lyrics yet" does not look like a change on every render. */
const NO_LINES: NotchLyricsSync["lines"] = [];

/*
 * The window is exactly as big as the shape it draws, never bigger.
 *
 * A fixed, mostly transparent window would sit over whatever is at the top of the screen and
 * swallow its clicks. Resizing the window only when the shape changes — not per frame — keeps
 * that out of the way: it grows before the shape expands and shrinks after it has collapsed.
 */
async function placeWindow(key: NotchSizeKey): Promise<void> {
  const monitor = (await primaryMonitor()) ?? (await currentMonitor());
  if (!monitor) return;
  const { width, height } = NOTCH_SIZES[key];
  const x = monitor.position.x
    + Math.round((monitor.size.width - width * monitor.scaleFactor) / 2);
  await Promise.all([
    win.setSize(new LogicalSize(width, height)),
    win.setPosition(new PhysicalPosition(x, monitor.position.y)),
  ]);
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** Playback time that keeps moving between the main window's once-a-second syncs. */
function useLiveTime(syncedTime: number, duration: number, running: boolean): number {
  const base = useRef({ time: syncedTime, at: performance.now() });
  const [time, setTime] = useState(syncedTime);

  useEffect(() => {
    base.current = { time: syncedTime, at: performance.now() };
    setTime(syncedTime);
  }, [syncedTime]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const elapsed = (performance.now() - base.current.at) / 1000;
      const next = base.current.time + elapsed;
      setTime(duration > 0 ? Math.min(duration, next) : next);
    }, 100);
    return () => window.clearInterval(id);
  }, [running, duration]);

  return time;
}

function useNotchLyrics(): NotchLyricsSync | null {
  const [lyrics, setLyrics] = useState<NotchLyricsSync | null>(null);

  useEffect(() => {
    const ready = listen<NotchLyricsSync>("notch-lyrics-sync", ({ payload }) => setLyrics(payload));
    // Asked for only once listening: the main window sent its last answer before this existed.
    void ready.then(() => emit("notch:request-lyrics"));
    return () => {
      void ready.then((unlisten) => unlisten());
    };
  }, []);

  return lyrics;
}

async function openMainWindow(): Promise<void> {
  const mainWin = await WebviewWindow.getByLabel("main");
  if (!mainWin) return;
  await mainWin.show();
  await mainWin.unminimize();
  await mainWin.setFocus();
}

export default function NotchPlayer() {
  const { playerState, timeState, artworkUrl } = useMiniPlayerBridge();
  const lyrics = useNotchLyrics();
  const reduceMotion = useReduceMotion();

  const isPlaying = playerState.status === "playing";
  const isLoading = playerState.status === "loading";
  const hasTrack = playerState.status !== "idle" && playerState.title !== null;
  const lines = lyrics?.lines ?? NO_LINES;
  const hasLyrics = lines.length > 0;
  const openKey: NotchSizeKey = hasLyrics ? "lyrics" : "compact";

  const [hovered, setHovered] = useState(false);
  const [peek, setPeek] = useState(false);
  const target: Shape = hovered || peek ? "open" : "pill";
  const [shape, setShape] = useState<Shape>("pill");

  // A new song opens the notch briefly. The first sync is the app starting up, not a new song.
  const lastTitleRef = useRef<string | null>(null);
  useEffect(() => {
    const title = playerState.title;
    const previous = lastTitleRef.current;
    lastTitleRef.current = title;
    if (!title || previous === null || previous === title) return;
    setPeek(true);
    const id = window.setTimeout(() => setPeek(false), PEEK_MS);
    return () => window.clearTimeout(id);
  }, [playerState.title]);

  const leaveTimerRef = useRef<number | undefined>(undefined);
  const handlePointerEnter = () => {
    window.clearTimeout(leaveTimerRef.current);
    setHovered(true);
  };
  const handlePointerLeave = () => {
    window.clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = window.setTimeout(() => setHovered(false), LEAVE_GRACE_MS);
  };
  useEffect(() => () => window.clearTimeout(leaveTimerRef.current), []);

  // Window geometry follows the target: grow first, draw second; collapse first, shrink second.
  useEffect(() => {
    if (!hasTrack) return;
    let cancelled = false;
    void (async () => {
      try {
        if (target === "open") {
          await placeWindow(openKey);
          if (!cancelled) setShape("open");
        } else {
          setShape("pill");
          await sleep(reduceMotion ? 0 : COLLAPSE_SETTLE_MS);
          if (!cancelled) await placeWindow("pill");
        }
      } catch {
        // The window is being destroyed under us (the setting was turned off).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target, openKey, hasTrack, reduceMotion]);

  // Visible only while there is something to show: placed first, so it never flashes elsewhere.
  useEffect(() => {
    void (async () => {
      try {
        if (hasTrack) {
          await placeWindow(target === "open" ? openKey : "pill");
          await win.show();
        } else {
          await win.hide();
        }
      } catch {
        // Destroyed mid-call.
      }
    })();
    // Placement on later target changes is the effect above's job.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTrack]);

  const liveTime = useLiveTime(
    timeState.currentTime,
    timeState.duration,
    isPlaying && shape === "open",
  );

  const lyricLines = useMemo(
    () => lines.map((line) => ({ text: line.text, startTimeSec: line.time })),
    [lines],
  );
  const activeIndex = hasLyrics
    ? findActiveLineIndex(lyricLines, liveTime + (lyrics?.offset ?? 0))
    : -1;

  const size = NOTCH_SIZES[shape === "open" ? openKey : "pill"];
  const spring = reduceMotion
    ? { duration: 0 }
    : ({ type: "spring", stiffness: 420, damping: 34, mass: 0.9 } as const);

  return (
    <div
      className="relative h-full w-full"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onContextMenu={(event) => event.preventDefault()}
    >
      <motion.div
        className="absolute left-1/2 top-0 -translate-x-1/2 overflow-hidden bg-black text-white"
        initial={false}
        animate={{
          width: size.width,
          height: size.height,
          borderBottomLeftRadius: shape === "open" ? 30 : 19,
          borderBottomRightRadius: shape === "open" ? 30 : 19,
        }}
        transition={spring}
        style={{ boxShadow: "0 8px 28px rgba(0,0,0,0.45)" }}
      >
        {/*
          The content is laid out at its final size and only clipped by the animating shape.
          Laid out against the shape instead, it was squeezed into a 38px-high box on every
          expand and collapse, and everything in it landed on top of everything else.
        */}
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2"
          style={{ width: size.width, height: size.height }}
        >
        {shape === "open" ? (
          <OpenContent
            title={playerState.title}
            artist={playerState.artist}
            artworkUrl={artworkUrl}
            isPlaying={isPlaying}
            isLoading={isLoading}
            currentTime={liveTime}
            duration={timeState.duration}
            lines={lines}
            activeIndex={activeIndex}
            showLyrics={hasLyrics}
            onOpenMain={() => void openMainWindow()}
          />
        ) : (
          <PillContent
            title={playerState.title}
            artist={playerState.artist}
            artworkUrl={artworkUrl}
            isPlaying={isPlaying}
            reduceMotion={reduceMotion}
          />
        )}
        </div>
      </motion.div>
    </div>
  );
}

function Cover({
  url,
  className,
  size,
  iconSize,
}: {
  url: string | null;
  className: string;
  size: number;
  iconSize: number;
}) {
  // The player's own artwork component, so covers load through the same cache, proxy and
  // retry ladder as everywhere else — and `size` keeps it from fetching the full-size cover.
  return (
    <TrackArtwork
      artworkUrl={url ?? undefined}
      className={cn("shrink-0 bg-neutral-800", className)}
      iconSize={iconSize}
      loading="eager"
      size={size}
    />
  );
}

function PillContent({
  title,
  artist,
  artworkUrl,
  isPlaying,
  reduceMotion,
}: {
  title: string | null;
  artist: string | null;
  artworkUrl: string | null;
  isPlaying: boolean;
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      className="flex h-full w-full items-center gap-2.5 px-3.5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.18 }}
    >
      <Cover url={artworkUrl} className="size-6 rounded-full" size={24} iconSize={11} />
      {/* Title and artist are separate boxes: one truncating run of text let them fuse. */}
      <div className="flex min-w-0 flex-1 items-baseline gap-2 leading-none">
        <span className="max-w-[62%] shrink-0 truncate text-[12px] font-semibold tracking-[-0.01em]">
          {title ?? "Nothing playing"}
        </span>
        {artist && (
          <span className="min-w-0 flex-1 truncate text-[11px] text-white/55">{artist}</span>
        )}
      </div>
      <Bars active={isPlaying && !reduceMotion} />
    </motion.div>
  );
}

/** Three bars that bounce while playing; flat when paused. */
function Bars({ active }: { active: boolean }) {
  return (
    <div className="flex h-3.5 w-[13px] shrink-0 items-end justify-between" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="w-[3px] rounded-full bg-white/80"
          initial={false}
          animate={{ height: active ? ["30%", "100%", "50%", "85%", "30%"] : "30%" }}
          transition={
            active
              ? { duration: 0.9 + index * 0.17, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.2 }
          }
        />
      ))}
    </div>
  );
}

/** Same look as the mini player's buttons, so the two compact players read as one family. */
const NOTCH_BUTTON =
  "flex size-7 shrink-0 items-center justify-center rounded-full text-neutral-300 transition-all hover:bg-white/10 hover:text-white active:scale-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50";

function OpenContent({
  title,
  artist,
  artworkUrl,
  isPlaying,
  isLoading,
  currentTime,
  duration,
  lines,
  activeIndex,
  showLyrics,
  onOpenMain,
}: {
  title: string | null;
  artist: string | null;
  artworkUrl: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  lines: NotchLyricsSync["lines"];
  activeIndex: number;
  showLyrics: boolean;
  onOpenMain: () => void;
}) {
  return (
    <motion.div
      className="flex h-full w-full items-stretch gap-4 px-4 pb-3.5 pt-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: 0.06 }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <button
          type="button"
          onClick={onOpenMain}
          aria-label="Open WEAV"
          title="Open WEAV"
          className="shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <Cover url={artworkUrl} className="size-[72px] rounded-2xl" size={72} iconSize={26} />
        </button>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold leading-tight tracking-[-0.01em]">
              {title ?? "Nothing playing"}
            </div>
            <div className="truncate text-[12px] leading-tight text-white/55">{artist ?? ""}</div>
          </div>

          <SeekRow currentTime={currentTime} duration={duration} />

          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              className={NOTCH_BUTTON}
              onClick={() => void emit("mini-player:skip-previous")}
              aria-label="Previous"
            >
              <SkipPreviousIcon size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-neutral-900 transition-transform duration-150 hover:scale-105 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              onClick={() => void emit("mini-player:toggle-play-pause")}
              aria-label={isLoading ? "Loading song" : isPlaying ? "Pause" : "Play"}
            >
              <span className="relative grid size-4 place-items-center" aria-hidden="true">
                <span className={cn("absolute transition-opacity duration-150", isLoading || isPlaying ? "opacity-0" : "opacity-100")}>
                  <PlayActiveIcon size={15} />
                </span>
                <span className={cn("absolute transition-opacity duration-150", !isLoading && isPlaying ? "opacity-100" : "opacity-0")}>
                  <PauseActiveIcon size={15} />
                </span>
                <span className={cn("absolute transition-opacity duration-150", isLoading ? "opacity-100" : "opacity-0")}>
                  <SpinnerSteps size={13} color="currentColor" />
                </span>
              </span>
            </button>
            <button
              type="button"
              className={NOTCH_BUTTON}
              onClick={() => void emit("mini-player:skip-next")}
              aria-label="Next"
            >
              <SkipNextIcon size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {showLyrics && (
        <div className="flex w-[188px] shrink-0 flex-col justify-center gap-1.5 border-l border-white/10 pl-4">
          <LyricsColumn lines={lines} activeIndex={activeIndex} />
        </div>
      )}
    </motion.div>
  );
}

/**
 * Position readout and slider, in the mini player's slider styling. A drag is held locally and
 * committed on release, so the thumb does not fight the once-a-second time sync mid-drag.
 */
function SeekRow({ currentTime, duration }: { currentTime: number; duration: number }) {
  const [dragValue, setDragValue] = useState<number | null>(null);
  const max = Math.max(duration, 1);
  const value = Math.min(max, dragValue ?? currentTime);
  const progress = (value / max) * 100;

  const commit = () => {
    if (dragValue === null) return;
    void emit("mini-player:seek", { time: dragValue });
    setDragValue(null);
  };

  return (
    <div className="flex items-center gap-2 text-[10px] tabular-nums text-white/55">
      <span className="w-7 text-right">{formatMinutesSeconds(value)}</span>
      <input
        type="range"
        min={0}
        max={max}
        step={0.1}
        value={value}
        disabled={duration <= 0}
        onChange={(event) => setDragValue(Number(event.target.value))}
        onPointerUp={commit}
        onPointerCancel={() => setDragValue(null)}
        onKeyUp={commit}
        aria-label="Song position"
        className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-transparent disabled:cursor-default [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,#fff_var(--slider-progress),rgba(255,255,255,0.18)_var(--slider-progress))] [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:-mt-[3px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-125"
        style={{ "--slider-progress": `${progress}%` } as CSSProperties}
      />
      <span className="w-8">-{formatMinutesSeconds(Math.max(0, duration - value))}</span>
    </div>
  );
}

/** The line being sung, large, and the one after it, dim — enough to follow along. */
function LyricsColumn({
  lines,
  activeIndex,
}: {
  lines: NotchLyricsSync["lines"];
  activeIndex: number;
}) {
  const current = activeIndex >= 0 ? lines[activeIndex]?.text : null;
  const next = lines[activeIndex + 1]?.text ?? null;

  return (
    <>
      <motion.p
        key={activeIndex}
        className="line-clamp-3 text-[15px] font-semibold leading-snug"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        {current ?? <MusicNoteIcon size={16} aria-hidden="true" className="text-white/50" />}
      </motion.p>
      {next && <p className="line-clamp-2 text-[12px] leading-snug text-white/35">{next}</p>}
    </>
  );
}
