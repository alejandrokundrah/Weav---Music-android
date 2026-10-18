import { type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CheckIcon, UserPlusIcon } from "@/ui/icons";
import type {
  Album,
  Artist,
  ArtistNotificationLevel,
  ArtistPage,
  Playlist,
  Track,
} from "../../datasource/types";
import { CoverCard, CoverCardSkeleton, ShelfRow } from "../components/phone/CoverCard";
import { GlassPlayGlyph } from "../components/phone/PhoneIcons";
import { TrackArtwork } from "../components/TrackArtwork";

type ReleaseFilter = "all" | "album" | "single" | "ep";

const NOTIFICATION_OPTIONS: ReadonlyArray<{ value: ArtistNotificationLevel; label: string }> = [
  { value: "all", label: "All releases" },
  { value: "personalized", label: "Personalized" },
  { value: "none", label: "Off" },
];

export interface PhoneArtistProps {
  artist: Artist;
  page: ArtistPage | null;
  isLoading: boolean;
  error: string | null;

  /* Playback of the whole catalogue */
  isCollectionPlaying: boolean;
  isCollectionLoading: boolean;
  onTogglePlay: () => void;
  onShuffle: () => void;
  onAddToQueue: () => void;

  /* Subscription */
  isSubscribed: boolean;
  isSubscribing: boolean;
  notificationLevel: ArtistNotificationLevel;
  onToggleSubscribe: () => void;
  onNotificationChange: (level: ArtistNotificationLevel) => void;

  /* Popular */
  popularSongs: readonly Track[];
  allSongsCount: number;
  hiddenSongCount: number;
  showAllSongs: boolean;
  onToggleShowAll: () => void;
  currentTrackId: string | null;
  isPlaying: boolean;
  viewsLabel: (track: Track) => string;
  onSelectTrack: (track: Track) => void;
  onTrackMenu: (event: MouseEvent<HTMLElement>, track: Track) => void;

  /* Releases */
  releaseFilters: readonly ReleaseFilter[];
  filter: ReleaseFilter;
  onFilterChange: (filter: ReleaseFilter) => void;
  releases: readonly Album[];
  onOpenAlbum: (album: Album) => void;
  onPlayAlbum: (album: Album) => void;
  onAlbumMenu: (event: MouseEvent<HTMLElement>, album: Album) => void;

  /* Playlists */
  playlists: readonly Playlist[];
  onOpenPlaylist: (playlist: Playlist) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onPlaylistMenu: (event: MouseEvent<HTMLElement>, playlist: Playlist) => void;
}

/**
 * The phone's artist page, drawn in the language of the phone Home and player screens: a
 * #131313 canvas, Lexend, a big rounded portrait with a warm bloom under it, round glass-style
 * controls, light-weight secondary text, and the same cover cards in horizontal shelves.
 *
 * No gutters of its own: the app's page container already provides the 20px the design uses,
 * and its search bar carries back and search. Presentational only. `ArtistView` still owns loading, caching, subscribing and playback, and
 * hands this component the results — so the desktop and phone layouts cannot drift apart in
 * behaviour, only in how they look.
 */
export function PhoneArtist(props: PhoneArtistProps) {
  const {
    artist,
    page,
    isLoading,
    error,
    isCollectionPlaying,
    isCollectionLoading,
    isSubscribed,
    isSubscribing,
    notificationLevel,
    popularSongs,
    releases,
    playlists,
  } = props;
  const hasSongs = (page?.allSongs.length ?? 0) > 0;
  const actionsDisabled = isLoading || Boolean(error) || !hasSongs;

  return (
    <div
      className="font-lexend flex flex-col pb-8 pt-1 text-white"
      style={{ "--card-w": "min(51vw, 15rem)" } as CSSProperties}
    >
      {/* Portrait. The shape and bloom are the player screen's artwork and the Home hero's
          shadow; the portrait is square-ish rather than circular to match them. */}
      <div className="mt-3 flex justify-center">
        <div
          className="w-[min(69vw,16.25rem)] overflow-hidden bg-[#1b1b1b]"
          style={{
            aspectRatio: "260 / 282",
            borderRadius: 32,
            boxShadow: "0 30px 70px rgb(255 134 117 / 0.28)",
          }}
        >
          <TrackArtwork
            className="size-full text-white/30"
            size={260}
            iconSize={64}
            artworkUrl={artist.artworkUrl}
            variant="artist"
            loading="eager"
            preferProxy
          />
        </div>
      </div>

      {/* `tracking-normal`: the base h1 rule adds negative tracking and a 700 weight that the
          design does not have — the same override the phone Home heading carries. */}
      <h1 className="mt-8 text-center text-[26px] font-semibold leading-8 tracking-normal text-white">
        {artist.name}
      </h1>
      {artist.subscriberCount ? (
        <p className="mt-1 text-center text-base font-light text-[#929292]">
          {artist.subscriberCount}
        </p>
      ) : null}

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
          label={isCollectionPlaying ? "Pause" : `Play ${artist.name}`}
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

      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          type="button"
          disabled={isLoading || Boolean(error) || isSubscribing}
          onClick={props.onToggleSubscribe}
          aria-pressed={isSubscribed}
          className={cn(
            "flex min-w-40 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-transform active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
            isSubscribed ? "bg-[#1b1b1b] text-white" : "bg-white text-[#131313]",
          )}
        >
          {isSubscribed ? <CheckIcon size={18} /> : <UserPlusIcon size={18} />}
          <span>
            {isSubscribing
              ? isSubscribed ? "Unsubscribing..." : "Subscribing..."
              : isSubscribed ? "Subscribed" : "Subscribe"}
          </span>
        </button>

        {/* Only while subscribed: YouTube drops the preference with the subscription, so
            offering it otherwise would accept a choice it then silently discards. */}
        {isSubscribed && (
          <div
            role="group"
            aria-label={`Notifications for ${artist.name}`}
            className="flex items-center gap-1.5"
          >
            {NOTIFICATION_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={notificationLevel === value}
                onClick={() => props.onNotificationChange(value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                  notificationLevel === value
                    ? "bg-[#2a2a2a] font-normal text-white"
                    : "bg-[#1b1b1b] font-extralight text-[#929292]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-16 text-center text-sm font-light text-[#929292]">{error}</p>
      )}

      {isLoading && !error && (
        <>
          <Section title="Popular">
            <div className="flex flex-col gap-3">
              {[0, 1, 2, 3].map((slot) => (
                <div key={slot} className="h-[60px] animate-pulse rounded-2xl bg-[#1b1b1b]" />
              ))}
            </div>
          </Section>
          <Section title="Releases">
            <ShelfRow label="Loading releases">
              {[0, 1].map((slot) => (
                <CoverCardSkeleton key={slot} layout="shelf" />
              ))}
            </ShelfRow>
          </Section>
        </>
      )}

      {!isLoading && !error && page && (
        <>
          {popularSongs.length > 0 && (
            <Section title="Popular">
              <div className="flex flex-col gap-1">
                {popularSongs.map((track, index) => {
                  const isCurrent = props.currentTrackId === track.id;
                  const views = props.viewsLabel(track);
                  return (
                    <SongRow
                      key={track.id}
                      track={track}
                      index={index}
                      views={views}
                      isCurrent={isCurrent}
                      isPlaying={isCurrent && props.isPlaying}
                      onSelect={() => props.onSelectTrack(track)}
                      onMenu={(event) => props.onTrackMenu(event, track)}
                    />
                  );
                })}
              </div>
              {(props.hiddenSongCount > 0 || props.showAllSongs) && (
                <button
                  type="button"
                  onClick={props.onToggleShowAll}
                  aria-expanded={props.showAllSongs}
                  className="self-center rounded-full bg-[#1b1b1b] px-5 py-2.5 text-sm font-light text-[#cdcdcd] transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  {props.showAllSongs ? "Show less" : `Show all ${props.allSongsCount} songs`}
                </button>
              )}
            </Section>
          )}

          {page.releases.length > 0 && (
            <Section title="Releases">
              {/* Same switch as the Home tabs: the chosen word is larger and brighter, the
                  rest are light grey. */}
              {props.releaseFilters.length > 1 && (
                <div
                  role="tablist"
                  aria-label="Release type"
                  className="-mt-2 flex items-baseline gap-6"
                >
                  {props.releaseFilters.map((type) => {
                    const selected = props.filter === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => props.onFilterChange(type)}
                        className={cn(
                          "py-1 transition-[color,font-size] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                          selected
                            ? "text-lg font-semibold text-[#e7e7e7] [text-shadow:0_10px_30px_rgba(255,255,255,0.3)]"
                            : "text-base font-extralight text-[#929292]",
                        )}
                      >
                        {filterLabel(type)}
                      </button>
                    );
                  })}
                </div>
              )}
              <ShelfRow key={props.filter} label="Releases">
                {releases.map((release) => (
                  <CoverCard
                    key={release.id}
                    layout="shelf"
                    title={release.title}
                    subtitle={releaseSubtitle(release)}
                    artworkUrl={release.artworkUrl}
                    variant="album"
                    onOpen={() => props.onOpenAlbum(release)}
                    onPlay={() => props.onPlayAlbum(release)}
                    onContextMenu={(event) => props.onAlbumMenu(event, release)}
                  />
                ))}
              </ShelfRow>
            </Section>
          )}

          {playlists.length > 0 && (
            <Section title="Playlists">
              <ShelfRow label="Playlists">
                {playlists.map((playlist) => (
                  <CoverCard
                    key={playlist.id}
                    layout="shelf"
                    title={playlist.title}
                    subtitle={playlist.owner}
                    artworkUrl={playlist.artworkUrl}
                    variant="playlist"
                    onOpen={() => props.onOpenPlaylist(playlist)}
                    onPlay={() => props.onPlayPlaylist(playlist)}
                    onContextMenu={(event) => props.onPlaylistMenu(event, playlist)}
                  />
                ))}
              </ShelfRow>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

/** Release subtitle: the type is more useful than repeating the artist's own name on their page. */
function releaseSubtitle(release: Album): string | undefined {
  if (release.releaseType) return filterLabel(release.releaseType).replace(/s$/, "");
  return release.artist || undefined;
}

function filterLabel(type: ReleaseFilter): string {
  return type === "all" ? "All" : type === "ep" ? "EPs" : `${type[0].toUpperCase()}${type.slice(1)}s`;
}

/** Same rhythm as the Home shelves: 50px above the heading, 27px between it and its content. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="relative mt-[50px] flex flex-col gap-[27px]">
      <h2 className="text-2xl font-medium leading-none tracking-normal text-[#e7e7e7]">{title}</h2>
      {children}
    </section>
  );
}

function RoundButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-[#1b1b1b] text-[#e7e7e7] transition-transform active:scale-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
        className,
      )}
    >
      {children}
    </button>
  );
}

function SongRow({
  track,
  index,
  views,
  isCurrent,
  isPlaying,
  onSelect,
  onMenu,
}: {
  track: Track;
  index: number;
  views: string;
  isCurrent: boolean;
  isPlaying: boolean;
  onSelect: () => void;
  onMenu: (event: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl py-1.5 pl-1.5 pr-1 transition-colors",
        isCurrent && "bg-[#1b1b1b]",
      )}
      onContextMenu={onMenu}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Play ${track.title}`}
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <span className="w-4 shrink-0 text-center text-xs font-extralight tabular-nums text-[#929292]">
          {isPlaying ? "▶" : index + 1}
        </span>
        <TrackArtwork
          className="size-12 shrink-0 rounded-xl bg-[#1b1b1b]"
          size={48}
          iconSize={20}
          artworkUrl={track.artworkUrl}
        />
        <span className="flex min-w-0 flex-col">
          <span
            className={cn(
              "truncate text-sm leading-[18px]",
              isCurrent ? "font-medium text-white" : "font-normal text-white",
            )}
          >
            {track.title}
          </span>
          {views ? (
            <span className="truncate text-xs font-extralight leading-[18px] text-[#929292]">
              {views} plays
            </span>
          ) : null}
        </span>
      </button>
      <button
        type="button"
        onClick={onMenu}
        aria-label={`More options for ${track.title}`}
        className="grid size-10 shrink-0 place-items-center rounded-full text-[#929292] transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <MoreGlyph />
      </button>
    </div>
  );
}

/* ── Icons ────────────────────────────────────────────────────────── */
/* Stroke icons in the 1.5-weight, round-capped style of the phone nav glyphs. */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function ShuffleGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7h3.5c2.2 0 3.6 1 4.8 2.8l1.4 2.4c1.2 1.8 2.6 2.8 4.8 2.8H21" {...stroke} />
      <path d="M3 17h3.5c1.6 0 2.8-.5 3.8-1.5M13.5 8.5C14.5 7.5 15.7 7 17.3 7H21" {...stroke} />
      <path d="M18.5 4.5L21 7l-2.5 2.5M18.5 14.5L21 17l-2.5 2.5" {...stroke} />
    </svg>
  );
}

function QueueGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h11M4 12h7M4 17h7" {...stroke} />
      <path d="M17 13v6M14 16h6" {...stroke} />
    </svg>
  );
}

function PauseGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
    </svg>
  );
}

function MoreGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5.5" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="18.5" r="1.4" fill="currentColor" />
    </svg>
  );
}
