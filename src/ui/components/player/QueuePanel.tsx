import { memo, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { LyricsCard } from "./LyricsCard";
import { DiscoverRail } from "./DiscoverRail";
import { Tooltip } from "@/components/motion/tooltip";
import {
  CheckIcon,
  ClockIcon,
  DiceIcon,
  PauseIcon,
  PlaylistAddIcon,
  ShuffleActiveIcon,
  ShuffleIcon,
  TrashIcon,
} from "@/ui/icons";
import { Loader, MusicVisualizer } from "@/components/motion/loader";
import { libraryController } from "../../../player/playerStore";
import { logInternalError } from "../../../internal/logging";
import type { Track } from "../../../datasource/types";
import {
  playerController,
  shallowEqual,
  usePlayerSelector,
  usePlayerSessionSelector,
} from "../../../player/playerStore";
import type { PlayerSession } from "../../../player/PlayerController";
import {
  toggleQueuePanelCollapsed,
  useQueuePanelCollapsed,
} from "../../settings/queuePanel";
import { ArtistLinks } from "../ArtistLinks";
import { TrackArtwork } from "../TrackArtwork";
import { formatTrackDuration } from "../../pages/formatTrackDuration";
import { SquareAltArrowLeftIcon, SquareAltArrowRightIcon } from "@solar-icons/react/linear";

interface QueuePanelProps {
  onClose: () => void;
  /** Opens the full lyrics page; the card at the foot of the rail is its preview. */
  onOpenLyrics?: () => void;
}

/** Pointer travel before a press becomes a drag rather than a click. */
const DRAG_SLOP_PX = 6;
/** Auto-generated tail rows rendered before "Show more" is needed. */
const AUTOMATIC_PAGE_SIZE = 30;

const ICON_BUTTON =
  "flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type QueueSection = "manual" | "automatic";

/** A queue entry paired with the absolute index the controller needs to act on it. */
interface QueueEntry {
  track: Track;
  /** Index into the whole queue — what removeFromQueueAt / moveQueueTrack expect. */
  absoluteIndex: number;
  /** 1-based position among upcoming tracks, for display. */
  position: number;
  section: QueueSection;
  /**
   * React key. Deliberately not `absoluteIndex`: every entry's absolute index shifts by one
   * the moment the current track advances, which used to give every row in the panel a new
   * key on every single track change — React read that as "all of these are different rows"
   * and remounted the entire list each time a song ended, throwing away images already
   * decoded and any hover/focus state. `track.id` is stable across that shift; the counter
   * only kicks in for the same track queued twice, which `track.id` alone can't disambiguate.
   */
  key: string;
}

/** Sums across the sections in place; spreading them into one array copied every upcoming track. */
function formatRemaining(...sections: QueueEntry[][]): string | null {
  let seconds = 0;
  for (const section of sections) {
    for (const { track } of section) {
      // One missing duration makes the total a lie, so don't show one at all.
      if (!track.durationSec) return null;
      seconds += track.durationSec;
    }
  }
  if (seconds === 0) return null;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`;
}

/**
 * One row of the queue.
 *
 * Memoised because an auto-queue is routinely 25+ tracks and the panel re-renders on every
 * player emit — including once per track change. Every prop here is a primitive or a stable
 * reference, so the comparison actually holds.
 */
const QueueRow = memo(function QueueRow({
  entry,
  collapsed,
  isDragged,
  isStopAfter,
  isGenerating,
  dropEdge,
  onPlay,
  onRemove,
  onStopAfter,
  onGenerateAfter,
  onPointerDown,
}: {
  entry: QueueEntry;
  collapsed: boolean;
  isDragged: boolean;
  /** Playback stops once this entry finishes. */
  isStopAfter: boolean;
  isGenerating: boolean;
  dropEdge: "before" | "after" | null;
  onPlay: (absoluteIndex: number) => void;
  onRemove: (absoluteIndex: number) => void;
  onStopAfter: (absoluteIndex: number) => void;
  onGenerateAfter: (absoluteIndex: number) => void;
  onPointerDown: (
    event: React.PointerEvent<HTMLButtonElement>,
    absoluteIndex: number,
    section: QueueSection,
  ) => void;
}) {
  const { track, absoluteIndex, position, section } = entry;
  const duration = formatTrackDuration(track.durationSec);

  const row = (
    <div
      data-queue-index={absoluteIndex}
      data-queue-section={section}
      className={cn(
        "group/queue-item relative flex items-center transition-colors hover:bg-card",
        // The pointer handler writes --drag-translation; this is what renders the lift.
        "[transform:translateY(var(--drag-translation,0px))]",
        collapsed
          ? "justify-center gap-1 rounded"
          : cn(
              // The spine: a rule down the left edge of the whole list. Accent where you chose
              // the song, neutral where autoplay did, so the origin of every row reads at a glance.
              "rounded-r-lg border-l-2",
              section === "manual" ? "border-primary/70" : "border-border",
            ),
        isDragged && "opacity-40",
        // Expanded draws its own "Queue ends here" break below the row. The rail has no room
        // for words, so it keeps the rule under the cover.
        collapsed
          && isStopAfter
          && "after:absolute after:inset-x-2 after:-bottom-px after:h-px after:bg-primary/70",
        dropEdge === "before" &&
          "before:absolute before:inset-x-2 before:-top-px before:h-0.5 before:rounded-full before:bg-primary",
        dropEdge === "after" &&
          "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary",
      )}
    >
      <button
        type="button"
        className={cn(
          "flex min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          collapsed
            ? "items-center rounded p-1.5"
            : "flex-1 items-baseline gap-3 rounded-r-lg py-2 pl-2.5 pr-2",
        )}
        onPointerDown={(event) => onPointerDown(event, absoluteIndex, section)}
        onClick={() => onPlay(absoluteIndex)}
        aria-label={collapsed ? `Play ${track.title}` : undefined}
      >
        {collapsed ? (
          /* The rail has no room for a number column, so the cover carries the position and
             the play affordance. */
          <span className="relative shrink-0">
            <TrackArtwork
              className="size-11 rounded"
              size={44}
              artworkUrl={track.artworkUrl}
              iconSize={20}
            />
            <span
              className={cn(
                "absolute inset-0 grid place-items-center rounded-lg bg-background/70 text-[11px] font-semibold tabular-nums text-foreground",
                /*
                 * The blur is applied on hover, not hidden by the opacity. `backdrop-filter` is
                 * what forces an element onto its own compositor layer, and this badge is
                 * mounted on every row in the queue — at `opacity-0` it showed nothing while
                 * still asking for a layer per row.
                 */
                "opacity-0 transition-opacity group-hover/queue-item:opacity-100 group-hover/queue-item:backdrop-blur-[2px]",
              )}
              aria-hidden="true"
            >
              {position}
            </span>
          </span>
        ) : (
          <>
            {/* A running order, so the position is real information and gets real weight. It
                is set on the title's baseline and warms to the accent on hover. */}
            <span
              className="w-6 shrink-0 text-right font-display text-lg font-medium leading-none tabular-nums text-muted-foreground transition-colors group-hover/queue-item:text-primary"
              aria-hidden="true"
            >
              {position}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm text-foreground">{track.title}</span>
              <ArtistLinks
                className="truncate text-xs text-muted-foreground"
                artists={track.artists}
                fallback={track.artist}
              />
            </span>
          </>
        )}
      </button>

      {!collapsed && (
        <>
          {/* Length sits where the actions appear, so hovering swaps one for the other instead
              of reflowing the title. */}
          {duration && (
            <span className="shrink-0 pr-3 text-xs tabular-nums text-muted-foreground transition-opacity group-focus-within/queue-item:opacity-0 group-hover/queue-item:opacity-0">
              {duration}
            </span>
          )}
          <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center rounded-full bg-card pl-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/queue-item:opacity-100">
            <Tooltip content={isStopAfter ? "Don't end queue here" : "End queue after this"}>
              <button
                type="button"
                className={cn(ICON_BUTTON, isStopAfter && "text-primary")}
                onClick={() => onStopAfter(absoluteIndex)}
                aria-pressed={isStopAfter}
              >
                <PauseIcon size={15} aria-hidden="true" />
                <span className="sr-only">
                  {isStopAfter ? "Don't end queue here" : "End queue after this"}
                </span>
              </button>
            </Tooltip>
            <Tooltip content="Generate a new queue from here">
              <button
                type="button"
                className={cn(ICON_BUTTON, isGenerating && "text-primary")}
                disabled={isGenerating}
                onClick={() => onGenerateAfter(absoluteIndex)}
              >
                <DiceIcon
                  size={15}
                  aria-hidden="true"
                  className={isGenerating ? "motion-safe:animate-spin" : undefined}
                />
                <span className="sr-only">Generate a new queue from here</span>
              </button>
            </Tooltip>
            <Tooltip content="Remove from queue">
              <button
                type="button"
                className={cn(ICON_BUTTON, "hover:text-primary")}
                onClick={() => onRemove(absoluteIndex)}
              >
                <TrashIcon size={15} aria-hidden="true" />
                <span className="sr-only">{`Remove ${track.title} from queue`}</span>
              </button>
            </Tooltip>
          </span>
        </>
      )}
    </div>
  );

  if (!collapsed) {
    return (
      <>
        {row}
        {/* Playback stops after this song, so the list visibly ends here. The break is a
            control too: pressing it takes the stop back. */}
        {isStopAfter && (
          <Tooltip content="Don't end queue here">
            <button
              type="button"
              onClick={() => onStopAfter(absoluteIndex)}
              className="group/stop my-1.5 flex w-full items-center gap-3 rounded px-3 py-0.5 text-xs text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="h-px flex-1 bg-primary/40" aria-hidden="true" />
              <span>Queue ends here</span>
              <span className="h-px flex-1 bg-primary/40" aria-hidden="true" />
              <span className="sr-only">Press to keep playing</span>
            </button>
          </Tooltip>
        )}
      </>
    );
  }

  // Collapsed hides the title, so the tooltip is the only way to read the row. Expanded
  // already shows everything, and a tooltip on every row would be noise.
  return (
    <Tooltip
      side="left"
      content={
        <span className="flex flex-col">
          <span className="font-medium">{track.title}</span>
          <span className="text-muted-foreground">{track.artist}</span>
        </span>
      }
    >
      {row}
    </Tooltip>
  );
});

const EMPTY_QUEUE: Track[] = [];

/*
 * `exportSession()` rebuilds the queue window with `.slice()` on every player emit — including
 * ones that never touch the queue, like a volume drag firing dozens of times a gesture — so a
 * plain read of `session.queue` gets a new array identity far more often than the queue itself
 * changes. Comparing by track identity (not the wrapping array) is what lets
 * `usePlayerSessionSelector` hand back the previous, still-equal snapshot on those emits.
 */
export function selectQueueSlice(session: PlayerSession | null) {
  return {
    queue: session?.queue ?? EMPTY_QUEUE,
    queueIndex: session?.queueIndex ?? -1,
    manualQueueLength: session?.manualQueueLength ?? 0,
    stopAfterQueueIndex: session?.stopAfterQueueIndex ?? null,
    queueWindowStart: session?.queueWindowStart ?? 0,
  };
}

export function queueSliceEqual(
  a: ReturnType<typeof selectQueueSlice>,
  b: ReturnType<typeof selectQueueSlice>,
) {
  return a.queueIndex === b.queueIndex
    && a.manualQueueLength === b.manualQueueLength
    && a.stopAfterQueueIndex === b.stopAfterQueueIndex
    && a.queueWindowStart === b.queueWindowStart
    && a.queue.length === b.queue.length
    && a.queue.every((track, index) => track === b.queue[index]);
}

/**
 * Reveals more of the auto-generated tail, a page at a time.
 *
 * Collapsed has no room for "Show 30 more", so it shrinks to a plain "+N" chip — the count
 * still reads on its own, and the full sentence is one tooltip away.
 */
function ShowMoreQueueButton({
  collapsed,
  remaining,
  onClick,
}: {
  collapsed: boolean;
  remaining: number;
  onClick: () => void;
}) {
  const label = `Show ${Math.min(AUTOMATIC_PAGE_SIZE, remaining)} more`;
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={collapsed ? label : undefined}
      className={cn(
        "shrink-0 rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        collapsed
          ? "mx-auto flex size-7 items-center justify-center text-sm"
          : "mt-0.5 px-3 py-1.5 text-left text-xs font-medium",
      )}
    >
      {collapsed ? "+" : label}
    </button>
  );
  return collapsed ? (
    <Tooltip side="left" content={label}>
      {button}
    </Tooltip>
  ) : (
    button
  );
}

export function QueuePanel({ onClose, onOpenLyrics }: QueuePanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const draggedElementRef = useRef<HTMLElement | null>(null);
  const captureElementRef = useRef<HTMLElement | null>(null);
  const pointerDragRef = useRef<{
    pointerId: number;
    sourceIndex: number;
    section: QueueSection;
    startX: number;
    startY: number;
    isDragging: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    index: number;
    insertAfter: boolean;
  } | null>(null);
  /*
   * The drop target is read inside a window listener that must not be torn down and rebuilt
   * on every pointermove — that is what the previous version did, since dropTarget was in the
   * effect's dependency list. The ref carries the value; the state only drives the paint.
   */
  const dropTargetRef = useRef(dropTarget);
  dropTargetRef.current = dropTarget;

  const collapsed = useQueuePanelCollapsed();
  const { queue, queueIndex, manualQueueLength, stopAfterQueueIndex, queueWindowStart } =
    usePlayerSessionSelector(selectQueueSlice, queueSliceEqual);
  // `stopAfterQueueIndex` comes off the session window-relative, like `queueIndex`; rebased once
  // here so every comparison against `entry.absoluteIndex` (already absolute) lines up.
  const stopAfterAbsoluteIndex = stopAfterQueueIndex === null
    ? null
    : stopAfterQueueIndex + queueWindowStart;
  const playerState = usePlayerSelector(
    (player) => ({ currentTrack: player.currentTrack, status: player.status }),
    shallowEqual,
  );
  const currentTrack = playerState.currentTrack;
  const isPlaying = playerState.status === "playing";
  // Generating hits the network, so the row it was started from shows it is working.
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  /* null = idle, string = the draft name being edited. */
  const [saveDraft, setSaveDraft] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  /*
   * The auto-generated tail can run up to 100 tracks (`PERSISTED_QUEUE_AHEAD`), and rendering
   * every one of them the moment the panel opens is exactly the "shows all songs at once" cost
   * — a hundred rows of artwork, truncated titles and hover affordances nobody is looking at
   * yet. Manual picks stay uncapped: that section is a handful of tracks by nature, not a
   * generated tail. "Show more" over a virtualiser: reordering drags read live DOM nodes
   * (`querySelectorAll("[data-queue-index]")`, `elementsFromPoint`), and a virtualiser that
   * only mounts what's on screen would have nothing to find a drop target on below the fold.
   */
  const [visibleAutomaticCount, setVisibleAutomaticCount] = useState(AUTOMATIC_PAGE_SIZE);

  /*
   * One flat pass over the upcoming tracks, tagged with everything a row needs. The old panel
   * sliced the queue three times and then recomputed the same absolute index inline at four
   * different call sites, each with its own `upcomingStartIndex + manualQueueLength + index`
   * arithmetic — which is exactly the sort of thing that drifts out of sync.
   */
  const { manual, automatic } = useMemo(() => {
    const start = Math.max(queueIndex + 1, 0);
    const manualEntries: QueueEntry[] = [];
    const automaticEntries: QueueEntry[] = [];
    // How many times each track id has been seen so far, so the same song queued twice still
    // gets two distinct keys.
    const seen = new Map<string, number>();

    for (let offset = 0; start + offset < queue.length; offset += 1) {
      const track = queue[start + offset];
      const occurrence = seen.get(track.id) ?? 0;
      seen.set(track.id, occurrence + 1);

      const entry: QueueEntry = {
        track,
        absoluteIndex: queueWindowStart + start + offset,
        position: offset + 1,
        section: offset < manualQueueLength ? "manual" : "automatic",
        key: occurrence === 0 ? track.id : `${track.id}:${occurrence}`,
      };
      (entry.section === "manual" ? manualEntries : automaticEntries).push(entry);
    }

    return { manual: manualEntries, automatic: automaticEntries };
  }, [manualQueueLength, queue, queueIndex, queueWindowStart]);

  const upcomingCount = manual.length + automatic.length;
  /*
   * Summed over the two lists in place rather than by spreading them into a third.
   *
   * `manual` and `automatic` are rebuilt whenever the queue array identity changes — which is
   * on every session export, not only when the queue actually changes — so this ran a full
   * copy plus a pass over every upcoming track far more often than the contents moved.
   */
  const remaining = useMemo(
    () => formatRemaining(manual, automatic),
    [automatic, manual],
  );

  const handleRemove = (absoluteIndex: number) => {
    playerController.removeFromQueueAt(absoluteIndex);
  };

  /*
   * Saves what is *upcoming* plus the track playing now — the queue as you see it. Tracks
   * already behind the playhead are history, and silently including them would produce a
   * playlist that does not match the panel it was made from.
   */
  const handleSaveQueue = async () => {
    if (saveDraft === null || saveState === "saving") return;
    const title = saveDraft.trim();
    if (!title) return;

    const trackIds = [
      ...(currentTrack ? [currentTrack.id] : []),
      ...manual.map((entry) => entry.track.id),
      ...automatic.map((entry) => entry.track.id),
    ].filter((id) => !id.startsWith("local:"));

    setSaveState("saving");
    try {
      await libraryController.createPlaylist(title, { trackIds });
      setSaveDraft(null);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 2000);
    } catch (error) {
      logInternalError("QueuePanel.saveQueueAsPlaylist failed", error);
      setSaveState("idle");
    }
  };

  const handleStopAfter = (absoluteIndex: number) => {
    playerController.setStopAfterQueueIndex(absoluteIndex);
  };

  const handleGenerateAfter = async (absoluteIndex: number) => {
    setGeneratingIndex(absoluteIndex);
    try {
      await playerController.generateQueueAfter(absoluteIndex);
    } finally {
      setGeneratingIndex(null);
    }
  };

  const handlePlay = (absoluteIndex: number) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    void playerController.playQueueTrackAt(absoluteIndex);
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = pointerDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      if (!drag.isDragging) {
        const distance = Math.hypot(
          event.clientX - drag.startX,
          event.clientY - drag.startY,
        );
        if (distance < DRAG_SLOP_PX) return;
        drag.isDragging = true;
        setDraggedIndex(drag.sourceIndex);
      }

      event.preventDefault();
      const translationY = event.clientY - drag.startY;
      draggedElementRef.current?.style.setProperty(
        "--drag-translation",
        `${translationY}px`,
      );

      // Reordering across the manual/automatic boundary is rejected by Queue.move, so the
      // drop indicator must never suggest it is possible.
      const items = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>("[data-queue-index]") ?? [],
      ).filter((item) =>
        Number(item.dataset.queueIndex) !== drag.sourceIndex
        && item.dataset.queueSection === drag.section,
      );

      if (items.length === 0) {
        setDropTarget(null);
        return;
      }

      let targetElement = document
        .elementsFromPoint(event.clientX, event.clientY)
        .map((element) => element.closest<HTMLElement>("[data-queue-index]"))
        .find((item) =>
          Boolean(item)
          && Number(item?.dataset.queueIndex) !== drag.sourceIndex
          && item?.dataset.queueSection === drag.section,
        ) ?? null;

      const panelBounds = panelRef.current?.getBoundingClientRect();
      if (panelBounds && event.clientY < panelBounds.top) {
        targetElement = items[0];
      } else if (panelBounds && event.clientY > panelBounds.bottom) {
        targetElement = items[items.length - 1];
      } else if (!targetElement) {
        targetElement = items.reduce<HTMLElement | null>((closest, item) => {
          if (!closest) return item;
          const itemBounds = item.getBoundingClientRect();
          const closestBounds = closest.getBoundingClientRect();
          const itemCenter = itemBounds.top + itemBounds.height / 2;
          const closestCenter = closestBounds.top + closestBounds.height / 2;
          return Math.abs(itemCenter - event.clientY)
            < Math.abs(closestCenter - event.clientY)
            ? item
            : closest;
        }, null);
      }

      if (!targetElement) {
        setDropTarget(null);
        return;
      }

      const targetIndex = Number(targetElement.dataset.queueIndex);
      const bounds = targetElement.getBoundingClientRect();
      const insertAfter = event.clientY >= bounds.top + bounds.height / 2;
      const current = dropTargetRef.current;
      if (current?.index === targetIndex && current.insertAfter === insertAfter) return;
      setDropTarget({ index: targetIndex, insertAfter });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const drag = pointerDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      const drop = dropTargetRef.current;
      if (drag.isDragging && drop && drop.index !== drag.sourceIndex) {
        playerController.moveQueueTrack(drag.sourceIndex, drop.index, drop.insertAfter);
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }

      pointerDragRef.current = null;
      draggedElementRef.current?.style.removeProperty("--drag-translation");
      draggedElementRef.current?.style.removeProperty("will-change");
      captureElementRef.current?.releasePointerCapture?.(event.pointerId);
      draggedElementRef.current = null;
      captureElementRef.current = null;
      setDraggedIndex(null);
      setDropTarget(null);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  const handleTrackPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    absoluteIndex: number,
    section: QueueSection,
  ) => {
    if (event.button !== 0) return;
    const trackItem = event.currentTarget.closest<HTMLElement>("[data-queue-index]");
    if (!trackItem) return;

    pointerDragRef.current = {
      pointerId: event.pointerId,
      sourceIndex: absoluteIndex,
      section,
      startX: event.clientX,
      startY: event.clientY,
      isDragging: false,
    };
    draggedElementRef.current = trackItem;
    captureElementRef.current = event.currentTarget;
    event.currentTarget.setPointerCapture(event.pointerId);
    trackItem.style.willChange = "transform";
  };

  const renderRows = (entries: QueueEntry[]) =>
    entries.map((entry) => (
      <QueueRow
        key={entry.key}
        entry={entry}
        collapsed={collapsed}
        isDragged={draggedIndex === entry.absoluteIndex}
        isStopAfter={stopAfterAbsoluteIndex === entry.absoluteIndex}
        isGenerating={generatingIndex === entry.absoluteIndex}
        dropEdge={
          dropTarget?.index === entry.absoluteIndex
            ? (dropTarget.insertAfter ? "after" : "before")
            : null
        }
        onPlay={handlePlay}
        onRemove={handleRemove}
        onStopAfter={handleStopAfter}
        onGenerateAfter={(index) => void handleGenerateAfter(index)}
        onPointerDown={handleTrackPointerDown}
      />
    ));

  const sectionLabel = (label: string, count: number) =>
    collapsed ? (
      // A hairline instead of a heading: at 76px a word would either truncate or wrap.
      <span
        className="mx-auto my-1.5 h-px w-6 rounded-full bg-border"
        role="separator"
        aria-label={label}
      />
    ) : (
      <div className="flex items-baseline justify-between gap-2 px-3 pb-1 pt-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      </div>
    );

  return (
    <aside className="flex h-full flex-col" aria-label="Queue">
    <div
      ref={panelRef as RefObject<HTMLDivElement>}
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain",
        // Dragging over rows must not select their text.
        draggedIndex !== null && "select-none",
      )}
    >
      <header
        className={cn(
          "sticky top-0 z-10 flex shrink-0 items-center gap-1",
          collapsed ? "flex-col px-2 py-2" : "px-3 py-2.5",
        )}
      >
        <Tooltip
          side={collapsed ? "left" : "bottom"}
          content={collapsed ? "Expand queue" : "Collapse queue"}
        >
          <button type="button" className={ICON_BUTTON} onClick={toggleQueuePanelCollapsed}>
            {collapsed ? (
              <SquareAltArrowLeftIcon size={22} aria-hidden="true" />
            ) : (
              <SquareAltArrowRightIcon size={22} aria-hidden="true" />
            )}
            <span className="sr-only">{collapsed ? "Expand queue" : "Collapse queue"}</span>
          </button>
        </Tooltip>

        {!collapsed && (
          <h2 className="min-w-0 flex-1 truncate pl-1 text-sm font-medium text-foreground">
            Queue
          </h2>
        )}

        {!collapsed && upcomingCount > 0 && (
          <>
            <Tooltip content="Shuffle what's next">
              <button
                type="button"
                className={ICON_BUTTON}
                onClick={() => playerController.shuffleUpcomingQueue()}
              >
                <ShuffleIcon size={16} aria-hidden="true" />
                <span className="sr-only">Shuffle what's next</span>
              </button>
            </Tooltip>
            <Tooltip content="Shuffle the whole playlist">
              <button
                type="button"
                className={ICON_BUTTON}
                onClick={() => playerController.shuffleEntirePlaylist()}
              >
                <ShuffleActiveIcon size={16} aria-hidden="true" />
                <span className="sr-only">Shuffle the whole playlist</span>
              </button>
            </Tooltip>
            <Tooltip content="Save the queue as a playlist">
              <button
                type="button"
                className={cn(ICON_BUTTON, saveState === "saved" && "text-primary")}
                onClick={() => setSaveDraft((draft) => (draft === null ? "My queue" : null))}
                aria-expanded={saveDraft !== null}
              >
                {saveState === "saving" ? (
                  <Loader variant="spinner" size={15} />
                ) : saveState === "saved" ? (
                  <CheckIcon size={16} aria-hidden="true" />
                ) : (
                  <PlaylistAddIcon size={16} aria-hidden="true" />
                )}
                <span className="sr-only">Save the queue as a playlist</span>
              </button>
            </Tooltip>
            <Tooltip content="Clear the queue">
              <button
                type="button"
                className={cn(ICON_BUTTON, "hover:text-primary")}
                onClick={() => playerController.clearUpcomingQueue()}
              >
                <TrashIcon size={16} aria-hidden="true" />
                <span className="sr-only">Clear the queue</span>
              </button>
            </Tooltip>
          </>
        )}
      </header>

      {/* Opens under the header so the queue it is about stays in view. */}
      {!collapsed && saveDraft !== null && (
        <div className="mx-2 mb-1 flex shrink-0 flex-col gap-2 rounded-xl bg-card p-2">
          <input
            autoFocus
            value={saveDraft}
            onChange={(event) => setSaveDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleSaveQueue();
              if (event.key === "Escape") setSaveDraft(null);
            }}
            aria-label="New playlist name"
            className="w-full min-w-0 rounded-lg bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-inset focus:ring-border"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              {upcomingCount + (currentTrack ? 1 : 0)} songs
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                className="rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setSaveDraft(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveState === "saving" || !saveDraft.trim()}
                className="rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-transform hover:scale-[1.02] active:scale-95 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => void handleSaveQueue()}
              >
                {saveState === "saving" ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* The track playing right now, as the panel's one large gesture: the cover runs the full
          width and the title is set over it in the display face. Everything below is quiet type,
          so this is the only thing that competes for the eye. */}
      {currentTrack && !collapsed && (
        <section
          aria-label="Now playing"
          className="relative mx-2 mb-4 shrink-0 overflow-hidden rounded-2xl bg-card"
        >
          <TrackArtwork
            className="aspect-[4/3] max-h-72 w-full"
            size={480}
            artworkUrl={currentTrack.artworkUrl}
            iconSize={48}
            loading="eager"
          />
          {/* Black, not a theme colour: this scrim exists to keep white type legible over any
              cover in any theme. */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-4 pb-3.5 pt-20">
            <h3 className="line-clamp-2 font-display text-[1.75rem] font-semibold leading-[1.05] text-white">
              {currentTrack.title}
            </h3>
            <div className="flex min-w-0 items-center gap-2 text-sm text-white/75">
              {isPlaying ? (
                <MusicVisualizer
                  bars={3}
                  className="[--music-gap:2px] [--music-height:12px] [--music-width:14px]"
                />
              ) : (
                <span className="shrink-0 text-white/70">
                  <PauseIcon size={14} aria-hidden="true" />
                  <span className="sr-only">Paused</span>
                </span>
              )}
              <ArtistLinks
                className="truncate"
                artists={currentTrack.artists}
                fallback={currentTrack.artist}
              />
            </div>
          </div>
        </section>
      )}

      {/* Rail: a cover and the meter, nothing else fits in 62px. */}
      {currentTrack && collapsed && (
        <div className="mx-2 mb-1 flex shrink-0 items-center justify-center rounded-2xl bg-white/[0.08] p-1.5">
          <span className="relative shrink-0">
            <TrackArtwork
              className="size-11 rounded-lg ring-1 ring-primary/60"
              size={44}
              artworkUrl={currentTrack.artworkUrl}
              iconSize={20}
            />
            {/*
              The same meter the track rows use — one now-playing indicator across the app,
              rather than two hand-rolled ones that drift apart.

              On a scrim covering the whole cover, not floated over the bottom edge: these are
              accent-tinted bars a few pixels tall, and against a busy album cover they were
              effectively invisible.
            */}
            {isPlaying && (
              <span
                className="absolute inset-0 grid place-items-center rounded bg-background/60 backdrop-blur-[2px]"
                aria-hidden="true"
              >
                <MusicVisualizer
                  bars={4}
                  className="[--music-gap:2px] [--music-height:16px] [--music-width:20px]"
                />
              </span>
            )}
          </span>
        </div>
      )}

      {!collapsed && (
        <div className="flex items-baseline justify-between gap-3 px-5 pb-2">
          <h3 className="font-display text-2xl font-medium leading-none text-foreground">Up next</h3>
          {upcomingCount > 0 && (
            <p className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
              <span>{upcomingCount === 1 ? "1 song" : `${upcomingCount} songs`}</span>
              {remaining && (
                <>
                  <ClockIcon size={11} aria-hidden="true" />
                  <span>{remaining}</span>
                </>
              )}
            </p>
          )}
        </div>
      )}

      {upcomingCount === 0 ? (
        collapsed ? null : (
          <p className="px-5 pb-6 pt-2 text-sm text-muted-foreground">
            Nothing queued. Songs you add with "Play next" land here.
          </p>
        )
      ) : (
        <div className={cn("flex flex-col pb-2", collapsed ? "gap-0.5 px-1.5" : "px-2")}>
          {manual.length > 0 && (
            <>
              {sectionLabel("Added by you", manual.length)}
              {renderRows(manual)}
            </>
          )}
          {automatic.length > 0 && (
            <>
              {manual.length > 0 && sectionLabel("Autoplay", automatic.length)}
              {renderRows(automatic.slice(0, visibleAutomaticCount))}
              {automatic.length > visibleAutomaticCount && (
                <ShowMoreQueueButton
                  collapsed={collapsed}
                  remaining={automatic.length - visibleAutomaticCount}
                  onClick={() =>
                    setVisibleAutomaticCount((count) => count + AUTOMATIC_PAGE_SIZE)}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Recommended + Top Artists. After the queue, which is what this panel is for. */}
      {!collapsed && <DiscoverRail />}

      {/* Collapsed has no room for a close button in the header, and the player bar's queue
          button already closes the panel, so this only exists when expanded. */}
      {!collapsed && (
        <button
          type="button"
          className="mx-2 mb-2 mt-auto shrink-0 rounded py-1.5 text-xs text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onClose}
        >
          Hide queue
        </button>
      )}
    </div>

    {/* Outside the scroller on purpose: it stays put while the queue scrolls behind it. */}
    {!collapsed && <LyricsCard onOpen={onOpenLyrics} />}
    </aside>
  );
}
