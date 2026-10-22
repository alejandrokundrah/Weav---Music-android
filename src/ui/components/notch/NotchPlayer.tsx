import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
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
import { formatSkinTime } from "../mini-player/skins/shared";
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

  const handleSeek = (event: PointerEvent<HTMLDivElement>) => {
    if (timeState.duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    void emit("mini-player:seek", { time: ratio * timeState.duration });
  };

  const stop = (event: MouseEvent) => event.stopPropagation();

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
            currentTime={liveTime}
            duration={timeState.duration}
            lines={lines}
            activeIndex={activeIndex}
            showLyrics={hasLyrics}
            onSeek={handleSeek}
            onOpenMain={() => void openMainWindow()}
            onStop={stop}
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

function Cover({ url, className }: { url: string | null; className: string }) {
  return (
    <div className={`shrink-0 overflow-hidden bg-white/10 ${className}`}>
      {url && <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />}
    </div>
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
      <Cover url={artworkUrl} className="h-6 w-6 rounded-full" />
      {/* Title and artist are separate boxes: one truncating run of text let them fuse. */}
      <div className="flex min-w-0 flex-1 items-baseline gap-2 leading-none">
        <span className="max-w-[62%] shrink-0 truncate text-[12px] font-semibold">
          {title ?? "Nothing playing"}
        </span>
        {artist && (
          <span className="min-w-0 flex-1 truncate text-[11px] text-white/45">{artist}</span>
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

function OpenContent({
  title,
  artist,
  artworkUrl,
  isPlaying,
  currentTime,
  duration,
  lines,
  activeIndex,
  showLyrics,
  onSeek,
  onOpenMain,
  onStop,
}: {
  title: string | null;
  artist: string | null;
  artworkUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  lines: NotchLyricsSync["lines"];
  activeIndex: number;
  showLyrics: boolean;
  onSeek: (event: PointerEvent<HTMLDivElement>) => void;
  onOpenMain: () => void;
  onStop: (event: MouseEvent) => void;
}) {
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

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
          onClick={(event) => {
            onStop(event);
            onOpenMain();
          }}
          aria-label="Open WEAV"
          title="Open WEAV"
          className="shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <Cover url={artworkUrl} className="h-[72px] w-[72px] rounded-2xl" />
        </button>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold leading-tight">
              {title ?? "Nothing playing"}
            </div>
            <div className="truncate text-[12px] leading-tight text-white/55">{artist ?? ""}</div>
          </div>

          <div className="flex items-center gap-2 text-[10px] tabular-nums text-white/55">
            <span className="w-7 text-right">{formatSkinTime(currentTime)}</span>
            <div
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
              className="group relative h-3 flex-1 cursor-pointer"
              onPointerDown={onSeek}
            >
              <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
            <span className="w-8">-{formatSkinTime(Math.max(0, duration - currentTime))}</span>
          </div>

          <div className="flex items-center justify-center gap-5">
            <ControlButton label="Previous" onClick={() => void emit("mini-player:skip-previous")}>
              <path d="M6 5h2v14H6zM20 5v14L9.5 12z" />
            </ControlButton>
            <ControlButton
              label={isPlaying ? "Pause" : "Play"}
              size="lg"
              onClick={() => void emit("mini-player:toggle-play-pause")}
            >
              {isPlaying
                ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                : <path d="M8 5v14l11-7z" />}
            </ControlButton>
            <ControlButton label="Next" onClick={() => void emit("mini-player:skip-next")}>
              <path d="M16 5h2v14h-2zM4 5v14l10.5-7z" />
            </ControlButton>
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

function ControlButton({
  label,
  onClick,
  size = "md",
  children,
}: {
  label: string;
  onClick: () => void;
  size?: "md" | "lg";
  children: ReactNode;
}) {
  const large = size === "lg";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={
        large
          ? "grid h-8 w-8 place-items-center rounded-full bg-white text-black transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          : "grid h-7 w-7 place-items-center rounded-full text-white/85 transition-colors hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      }
    >
      <svg viewBox="0 0 24 24" className={large ? "h-4 w-4" : "h-[18px] w-[18px]"} fill="currentColor" aria-hidden="true">
        {children}
      </svg>
    </button>
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
        {current ?? "♪"}
      </motion.p>
      {next && <p className="line-clamp-2 text-[12px] leading-snug text-white/35">{next}</p>}
    </>
  );
}
