import { memo, useRef, type MouseEvent, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";
import { MusicVisualizer, SpinnerSteps } from "@/components/motion/loader";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  CloseIcon,
  DownloadIcon,
  PlayActiveIcon,
  PlaylistAddIcon,
  RepeatActiveIcon,
  RepeatOneActiveIcon,
  SearchIcon,
} from "@/ui/icons";
import type { Track } from "../../datasource/types";
import { propsEqualIgnoringHandlers } from "../../internal/propsEqual";
import { useUnavailableOffline } from "../../player/offlineStore";
import {
  MoreGlyph,
  PauseGlyph,
  QueueGlyph,
  RoundButton,
  ShuffleGlyph,
} from "../components/phone/PhoneControls";
import { GlassPlayGlyph } from "../components/phone/PhoneIcons";
import { TrackArtwork } from "../components/TrackArtwork";
import { formatTrackDuration } from "./formatTrackDuration";

export type PhoneLoopMode = "in-order" | "repeat-all" | "repeat-one";

export interface PhoneCollectionSort {
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  direction: "asc" | "desc";
  /** "Newest", "Asc" — spoken as part of the selected option's accessible name. */
  directionLabel: string;
  onSelect: (value: string) => void;
}

export interface PhoneCollectionProps {
  kind: "album" | "playlist";
  title: string;
  /** Artist links on an album, the owner on a playlist. */
  subtitle?: ReactNode;
  /** "12 songs · 42 min". Held back until the tracks are in, so it never reads "0 songs". */
  meta?: string;
  artworkUrl?: string;
  /** Replaces the artwork entirely — Liked Songs ships its own cover. */
  artworkSlot?: ReactNode;
  /** Long-press on the cover and title: the same menu a right-click opens on desktop. */
  onHeaderContextMenu?: (event: MouseEvent<HTMLElement>) => void;

  isLoading: boolean;
  error: string | null;
  /** Shown once loading is done and there is nothing to list. Null when the list is not empty. */
  emptyMessage: string | null;
  actionsDisabled: boolean;

  /* Whole-collection actions */
  isCollectionPlaying: boolean;
  isCollectionLoading: boolean;
  onTogglePlay: () => void;
  onShuffle: () => void;
  onAddToQueue: () => void;
  onAddToPlaylist: () => void;
  loopMode: PhoneLoopMode;
  /** Starts a loop, or cycles it when this collection is already looping — the page decides. */
  onLoop: () => void;
  download: {
    onStart: () => void;
    /** The rest of the collection is still being paged in before the download can start. */
    isBusy?: boolean;
    counts: { downloaded: number; total: number; isPartial?: boolean };
  };
  /** The collection's own menu (save, rename, delete…). Omit to hide the button. */
  onMore?: (event: MouseEvent<HTMLElement>) => void;
  /** Extra pills after the standard ones — the local playlist's "add folder". */
  extraActions?: ReactNode;
  /** Playlist description, between the actions and the song list. */
  description?: ReactNode;

  /* Find and order */
  /** Whether to show search and sort at all. They stand apart from the loading state. */
  showTools: boolean;
  searchLabel: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchInputRef?: Ref<HTMLInputElement>;
  sort?: PhoneCollectionSort;

  /* Songs */
  tracks: readonly Track[];
  getTrackKey: (track: Track, index: number) => string;
  /** Albums leave it off: the cover above is every row's cover. */
  showTrackArtwork: boolean;
  /** An album's own artist — rows by that artist skip repeating the name under every title. */
  hideArtistFor?: string;
  currentTrackId: string | null;
  isPlaying: boolean;
  onSelectTrack: (track: Track) => void;
  onTrackMenu: (event: MouseEvent<HTMLElement>, track: Track) => void;
  /** Rendered straight after the list: the infinite-scroll sentinel and its status line. */
  listFooter?: ReactNode;
}

/** One pill in the action row. Exported so a page can add its own in the same style. */
export const PHONE_PILL_CLASS =
  "flex items-center gap-2 rounded-full bg-[#1b1b1b] px-4 py-2.5 text-sm font-light text-[#cdcdcd] transition-transform active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40";
const PILL_ON_CLASS = "bg-[#2a2a2a] font-normal text-white";

/**
 * The phone's album and playlist page, drawn in the language of the phone Home, artist and
 * player screens: a `#131313` canvas, Lexend, a large rounded cover with the warm bloom under
 * it, the round shuffle · play · queue row, light-weight grey secondary text, and `#1b1b1b`
 * surfaces for everything tappable.
 *
 * No gutters of its own — the app's page container supplies the 20px — and no back button: the
 * search bar above it carries back and search. Presentational only. `AlbumView` and
 * `PlaylistView` still own loading, paging, sorting and playback and hand this the results, so
 * the desktop and phone layouts cannot drift apart in behaviour, only in how they look.
 */
export function PhoneCollection(props: PhoneCollectionProps) {
  const {
    kind,
    title,
    isLoading,
    error,
    actionsDisabled,
    isCollectionPlaying,
    isCollectionLoading,
    loopMode,
    download,
    tracks,
  } = props;

  const kindLabel = kind === "album" ? "Album" : "Playlist";
  const metaLine = props.meta && !isLoading && !error ? `${kindLabel} · ${props.meta}` : kindLabel;

  const isLooping = loopMode !== "in-order";
  const remaining = Math.max(0, download.counts.total - download.counts.downloaded);
  const allDownloaded =
    download.counts.total > 0 && remaining === 0 && !download.counts.isPartial;
  const downloadBusy = Boolean(download.isBusy);
  const downloadLabel = downloadBusy
    ? "Preparing"
    : allDownloaded
      ? "Downloaded"
      : download.counts.downloaded > 0 && !download.counts.isPartial
        ? `Download ${remaining} more`
        : "Download";

  return (
    <div className="font-lexend flex flex-col pb-8 pt-1 text-white">
      <div className="flex flex-col" onContextMenu={props.onHeaderContextMenu}>
        {/* The cover. The shape and bloom are the artist page's portrait and the Home hero's
            shadow, so the three read as one family. */}
        <div className="mt-3 flex justify-center">
          <div
            className="w-[min(69vw,16.25rem)] overflow-hidden bg-[#1b1b1b]"
            style={{
              aspectRatio: "1 / 1",
              borderRadius: 32,
              boxShadow: "0 30px 70px rgb(255 134 117 / 0.28)",
            }}
          >
            {props.artworkSlot ?? (
              <TrackArtwork
                className="size-full text-white/30"
                size={260}
                iconSize={64}
                artworkUrl={props.artworkUrl}
                variant={kind}
                loading="eager"
              />
            )}
          </div>
        </div>

        {/* `tracking-normal`: the base h1 rule adds negative tracking and a 700 weight that the
            design does not have — the same override the Home and artist headings carry. */}
        <h1 className="mt-8 line-clamp-2 text-center text-[26px] font-semibold leading-8 tracking-normal text-white">
          {title}
        </h1>
        {props.subtitle ? (
          <div className="mt-1 text-center text-base font-light text-[#cdcdcd]">
            {props.subtitle}
          </div>
        ) : null}
        <p className="mt-1 text-center text-sm font-extralight text-[#929292]">{metaLine}</p>
      </div>

      {/* Shuffle · Play · Queue, the player screen's control row. */}
      <div className="mt-7 flex items-center justify-center gap-7">
        <RoundButton
          label="Shuffle"
          onClick={props.onShuffle}
          disabled={actionsDisabled}
          className="size-12"
        >
          <ShuffleGlyph />
        </RoundButton>
        <RoundButton
          label={isCollectionPlaying ? "Pause" : `Play ${title}`}
          onClick={props.onTogglePlay}
          disabled={actionsDisabled}
          className="size-16"
        >
          {isCollectionLoading ? (
            <span className="size-5 animate-spin rounded-full border-2 border-white/25 border-t-white" />
          ) : isCollectionPlaying ? (
            <PauseGlyph />
          ) : (
            <GlassPlayGlyph size={64} className="size-full" />
          )}
        </RoundButton>
        <RoundButton
          label="Add to queue"
          onClick={props.onAddToQueue}
          disabled={actionsDisabled}
          className="size-12"
        >
          <QueueGlyph />
        </RoundButton>
      </div>

      {/* The rest of the actions, as pills. Each says what it does in words: on a phone there
          is no tooltip to explain an icon on hover. */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          disabled={actionsDisabled}
          onClick={props.onAddToPlaylist}
          className={PHONE_PILL_CLASS}
        >
          <PlaylistAddIcon size={18} aria-hidden="true" />
          Add to playlist
        </button>

        <button
          type="button"
          disabled={actionsDisabled || allDownloaded || downloadBusy}
          onClick={download.onStart}
          aria-busy={downloadBusy}
          className={cn(PHONE_PILL_CLASS, allDownloaded && PILL_ON_CLASS)}
        >
          {downloadBusy ? (
            <SpinnerSteps size={18} color="currentColor" />
          ) : allDownloaded ? (
            <CheckIcon size={18} aria-hidden="true" />
          ) : (
            <DownloadIcon size={18} aria-hidden="true" />
          )}
          {downloadLabel}
        </button>

        <button
          type="button"
          disabled={actionsDisabled}
          onClick={props.onLoop}
          aria-pressed={isLooping}
          aria-label={
            loopMode === "repeat-one"
              ? "Loop current song"
              : loopMode === "repeat-all"
                ? "Loop queue"
                : "Play in loop"
          }
          className={cn(PHONE_PILL_CLASS, isLooping && PILL_ON_CLASS)}
        >
          {loopMode === "repeat-one" ? (
            <RepeatOneActiveIcon size={18} aria-hidden="true" />
          ) : (
            <RepeatActiveIcon size={18} aria-hidden="true" />
          )}
          {loopMode === "repeat-one" ? "Loop one" : loopMode === "repeat-all" ? "Loop all" : "Loop"}
        </button>

        {props.extraActions}

        {props.onMore ? (
          <button
            type="button"
            onClick={props.onMore}
            aria-label={`More options for ${title}`}
            className={cn(PHONE_PILL_CLASS, "size-[42px] justify-center px-0")}
          >
            <MoreGlyph />
          </button>
        ) : null}
      </div>

      {props.description ? <div className="mt-7">{props.description}</div> : null}

      {error && <p className="mt-16 text-center text-sm font-light text-[#929292]">{error}</p>}

      {!error && props.emptyMessage && (
        <p className="mt-16 text-center text-sm font-light text-[#929292]">{props.emptyMessage}</p>
      )}

      {!error && props.showTools && (
        <>
          <div
            role="search"
            className="mt-8 flex h-12 items-center gap-3 rounded-full bg-[#1b1b1b] pl-4 pr-2 text-[#929292] transition-shadow focus-within:ring-2 focus-within:ring-white/30"
          >
            <SearchIcon size={18} aria-hidden="true" className="shrink-0" />
            <input
              ref={props.searchInputRef}
              type="text"
              value={props.searchQuery}
              aria-label={props.searchLabel}
              placeholder={props.searchLabel}
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => props.onSearchChange(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-light text-white outline-none placeholder:text-[#929292]"
            />
            {props.searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => props.onSearchChange("")}
                className="grid size-8 shrink-0 place-items-center rounded-full text-[#929292] transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <CloseIcon size={16} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Same switch as the Home tabs and the artist's release filter: the chosen word is
              larger and brighter, the rest are light grey. The arrow only rides on the chosen
              one, so a second tap reads as "reverse". */}
          {props.sort && (
            <div role="group" aria-label="Sort songs" className="mt-6 flex items-baseline gap-6">
              {props.sort.options.map((option) => {
                const sort = props.sort!;
                const selected = sort.value === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`Sort by ${option.label}${selected ? ` ${sort.directionLabel}` : ""}`}
                    onClick={() => sort.onSelect(option.value)}
                    className={cn(
                      "flex items-center gap-1.5 py-1 transition-[color,font-size] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                      selected
                        ? "text-lg font-semibold text-[#e7e7e7] [text-shadow:0_10px_30px_rgba(255,255,255,0.3)]"
                        : "text-base font-extralight text-[#929292]",
                    )}
                  >
                    {option.label}
                    {selected &&
                      (sort.direction === "asc" ? (
                        <ArrowUpIcon size={14} strokeWidth={2.2} aria-hidden="true" />
                      ) : (
                        <ArrowDownIcon size={14} strokeWidth={2.2} aria-hidden="true" />
                      ))}
                  </button>
                );
              })}
            </div>
          )}

          {isLoading ? (
            <div className="mt-6 flex flex-col gap-1" role="status" aria-label="Loading songs">
              {[0, 1, 2, 3, 4, 5].map((slot) => (
                <div
                  key={slot}
                  className="h-[60px] animate-pulse rounded-2xl bg-[#1b1b1b]"
                  style={{ animationDelay: `${slot * 60}ms` }}
                />
              ))}
            </div>
          ) : tracks.length === 0 && props.searchQuery.trim() ? (
            <p className="mt-10 text-center text-sm font-light text-[#929292]">
              No songs match this search.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-1">
              {tracks.map((track, index) => {
                /*
                 * Matched on track identity rather than row position: the same song can appear
                 * twice, and the queue can be shuffled or reordered out from under this list.
                 */
                const isCurrent = props.currentTrackId !== null && track.id === props.currentTrackId;
                return (
                  <TrackItem
                    key={props.getTrackKey(track, index)}
                    track={track}
                    index={index}
                    showArtwork={props.showTrackArtwork}
                    hideArtistFor={props.hideArtistFor}
                    isCurrent={isCurrent}
                    isPlaying={isCurrent && props.isPlaying}
                    onSelect={() => props.onSelectTrack(track)}
                    onMenu={(event) => props.onTrackMenu(event, track)}
                  />
                );
              })}
            </div>
          )}
          {props.listFooter}
        </>
      )}
    </div>
  );
}

/* ── Rows ─────────────────────────────────────────────────────────── */

type TrackItemProps = {
  track: Track;
  /** Zero-based; shown as the 1-based position. */
  index: number;
  showArtwork: boolean;
  hideArtistFor?: string;
  isCurrent: boolean;
  isPlaying: boolean;
  onSelect: () => void;
  onMenu: (event: MouseEvent<HTMLElement>) => void;
};

/**
 * One song. The artist page's row, with a position (or the level meter) in front, the length
 * behind, and an optional cover.
 *
 * Memoised with the handlers read through a ref — the same pairing `TrackRow` uses. These lists
 * are not windowed and a playlist can run to hundreds of rows, while every track change
 * re-renders the list to move the highlight; without this each change rebuilds all of them to
 * repaint two. Inline arrows from the parent differ every render, so the comparison ignores
 * them, and the ref is what keeps that safe: a row that skipped a render still acts on the
 * newest closure.
 */
const TrackItem = memo(function TrackItem({
  track,
  index,
  showArtwork,
  hideArtistFor,
  isCurrent,
  isPlaying,
  onSelect,
  onMenu,
}: TrackItemProps) {
  const handlersRef = useRef({ onSelect, onMenu });
  handlersRef.current = { onSelect, onMenu };

  const unavailableOffline = useUnavailableOffline(track);
  const subtitle = track.artist && track.artist !== hideArtistFor ? track.artist : "";
  const duration = formatTrackDuration(track.durationSec);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl py-1.5 pl-1.5 pr-1 transition-colors",
        /* Off-screen rows skip layout and paint — the lists are not windowed, see TrackRow. */
        "[content-visibility:auto] [contain-intrinsic-size:auto_60px]",
        isCurrent && "bg-[#1b1b1b]",
        unavailableOffline && "opacity-40",
      )}
      aria-current={isCurrent ? "true" : undefined}
      onContextMenu={(event) => handlersRef.current.onMenu(event)}
    >
      <button
        type="button"
        onClick={() => handlersRef.current.onSelect()}
        aria-label={`Play ${track.title}`}
        title={unavailableOffline ? "Not downloaded. Plays when you're back online." : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <span className="grid w-5 shrink-0 place-items-center text-xs font-extralight tabular-nums text-[#929292]">
          {isPlaying ? (
            /* The meter takes `--color-primary`, which is lime on the phone; this screen is
               white, so it is overridden for just this glyph. */
            <span className="[--color-primary:#ffffff]" aria-hidden="true">
              <MusicVisualizer
                bars={4}
                className="[--music-gap:2px] [--music-height:13px] [--music-width:15px]"
              />
            </span>
          ) : isCurrent ? (
            <PlayActiveIcon size={12} className="text-white" aria-hidden="true" />
          ) : (
            index + 1
          )}
        </span>

        {showArtwork ? (
          <TrackArtwork
            className="size-12 shrink-0 rounded-xl bg-[#1b1b1b]"
            size={48}
            iconSize={20}
            artworkUrl={track.artworkUrl}
          />
        ) : null}

        <span className="flex min-w-0 flex-col">
          {/* The badge is a sibling of the title so `truncate` shortens the name instead of
              pushing the stamp off the row. */}
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                "truncate text-sm leading-[18px] text-white",
                isCurrent ? "font-medium" : "font-normal",
              )}
            >
              {track.title}
            </span>
            {track.isExplicit && (
              <span
                role="img"
                aria-label="Explicit"
                title="Explicit"
                className="grid size-[15px] shrink-0 place-items-center rounded-[3px] bg-[#929292] text-[10px] font-semibold leading-none text-[#131313]"
              >
                <span aria-hidden="true">E</span>
              </span>
            )}
          </span>
          {subtitle ? (
            <span className="truncate text-xs font-extralight leading-[18px] text-[#929292]">
              {subtitle}
            </span>
          ) : null}
        </span>
      </button>

      {duration ? (
        <span className="shrink-0 text-xs font-extralight tabular-nums text-[#929292]">
          {duration}
        </span>
      ) : null}

      <button
        type="button"
        onClick={(event) => handlersRef.current.onMenu(event)}
        aria-label={`More options for ${track.title}`}
        className="grid size-10 shrink-0 place-items-center rounded-full text-[#929292] transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <MoreGlyph />
      </button>
    </div>
  );
}, propsEqualIgnoringHandlers);
