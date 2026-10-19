import {
  type MouseEvent,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { MusicVisualizer } from "@/components/motion/loader";
import { ArrowLeftIcon, PlayActiveIcon } from "@/ui/icons";
import type {
  Album,
  Artist,
  BrowsePage as BrowsePageData,
  BrowseShelf,
  Playlist,
  Track,
} from "../../datasource/types";
import {
  CoverCard,
  CoverCardSkeleton,
  ShelfRow,
} from "../components/phone/CoverCard";
import { MoreGlyph, RoundButton } from "../components/phone/PhoneControls";
import { TrackArtwork } from "../components/TrackArtwork";
import { formatTrackDuration } from "./formatTrackDuration";
import type { BrowseTab } from "./BrowsePage";

export interface PhoneBrowseProps {
  surface: BrowseTab;
  onSurfaceChange: (surface: BrowseTab) => void;
  drillDown: ReadonlyArray<{ browseId: string; title: string; params?: string }>;
  onDrillDown: (link: { browseId: string; title: string; params?: string }) => void;
  onBackDrillDown: () => void;
  isLoading: boolean;
  error: string | null;
  page: BrowsePageData | null;
  isDownloads: boolean;
  downloads: ReadonlyArray<{ track: Track; byteLength: number; downloadedAt: number }>;
  inFlight: ReadonlyArray<Track>;
  downloadingId: string | null;
  downloadProgress: number | null;
  onRemoveAllDownloads: () => void;
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track, queue: readonly Track[]) => void;
  onTrackMenu: (event: MouseEvent<HTMLElement>, track: Track) => void;
  onOpenAlbum: (album: Album) => void;
  onOpenArtist: (artist: Artist) => void;
  onOpenPlaylist: (playlist: Playlist) => void;
  onPlaylistMenu?: (event: MouseEvent<HTMLElement>, playlist: Playlist) => void;
  onAlbumMenu?: (event: MouseEvent<HTMLElement>, album: Album) => void;
}

const SURFACES: ReadonlyArray<{ value: BrowseTab; label: string }> = [
  { value: "explore", label: "Explore" },
  { value: "charts", label: "Charts" },
  { value: "moods", label: "Moods & Genres" },
  { value: "podcasts", label: "Podcasts" },
  { value: "downloads", label: "Downloads" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/**
 * Phone Browse screen:
 * - Deep #131313 background, Lexend headers
 * - Surface selector pills (Explore, Charts, Moods, Podcasts, Downloads)
 * - Deep horizontal cover shelves (ShelfRow + CoverCard)
 * - Touch-sized chart song rows and mood pill grids
 * - Full offline downloads shelf and storage management
 */
export function PhoneBrowse({
  surface,
  onSurfaceChange,
  drillDown,
  onDrillDown,
  onBackDrillDown,
  isLoading,
  error,
  page,
  isDownloads,
  downloads,
  inFlight,
  downloadingId,
  downloadProgress,
  onRemoveAllDownloads,
  currentTrackId,
  isPlaying,
  onPlayTrack,
  onTrackMenu,
  onOpenAlbum,
  onOpenArtist,
  onOpenPlaylist,
}: PhoneBrowseProps) {
  const [confirmClearDownloads, setConfirmClearDownloads] = useState(false);
  const activeTitle =
    drillDown.length > 0
      ? drillDown[drillDown.length - 1].title
      : SURFACES.find((s) => s.value === surface)?.label ?? "Browse";

  const totalDownloadBytes = downloads.reduce((acc, d) => acc + d.byteLength, 0);

  return (
    <div className="flex min-h-full flex-col bg-[#131313] px-5 pb-28 pt-2 font-lexend text-[#e7e7e7]">
      {/* Header */}
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          {drillDown.length > 0 && (
            <button
              type="button"
              onClick={onBackDrillDown}
              aria-label="Back"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[#1b1b1b] text-[#e7e7e7] transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <ArrowLeftIcon size={18} aria-hidden="true" />
            </button>
          )}

          <h1 className="text-[28px] font-semibold leading-tight tracking-normal text-white">
            {activeTitle}
          </h1>
        </div>

        {/* Surfaces Bar (when not drilled into sub-feed) */}
        {drillDown.length === 0 && (
          <div
            role="tablist"
            aria-label="Browse surfaces"
            className="-mx-5 flex items-center gap-2 overflow-x-auto px-5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {SURFACES.map((item) => {
              const selected = surface === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => onSurfaceChange(item.value)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-light transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                    selected
                      ? "bg-white font-medium text-[#131313] shadow-[0_2px_12px_rgba(255,255,255,0.2)]"
                      : "bg-[#1b1b1b] text-[#929292] hover:text-[#e7e7e7]",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="mt-6 flex flex-col gap-8">
        {/* DOWNLOADS SURFACE */}
        {isDownloads ? (
          <div className="flex flex-col gap-6">
            {/* Storage summary banner */}
            <div className="flex items-center justify-between rounded-2xl bg-[#1b1b1b] p-4 text-xs font-light text-[#cdcdcd]">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-white">
                  {downloads.length} {downloads.length === 1 ? "song" : "songs"} downloaded
                </span>
                <span className="text-[#929292]">{formatBytes(totalDownloadBytes)} on disk</span>
              </div>

              {downloads.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirmClearDownloads) {
                      onRemoveAllDownloads();
                      setConfirmClearDownloads(false);
                    } else {
                      setConfirmClearDownloads(true);
                      setTimeout(() => setConfirmClearDownloads(false), 3500);
                    }
                  }}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-xs font-medium transition-colors",
                    confirmClearDownloads
                      ? "bg-red-500/20 text-red-400"
                      : "bg-[#252525] text-[#929292] hover:text-white",
                  )}
                >
                  {confirmClearDownloads ? "Confirm delete all" : "Clear all"}
                </button>
              )}
            </div>

            {/* In-Flight pending downloads */}
            {inFlight.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-medium text-[#929292]">Downloading</h2>
                <div className="flex flex-col gap-1">
                  {inFlight.map((track) => {
                    const isActive = downloadingId === track.id;
                    return (
                      <div
                        key={`pending:${track.id}`}
                        className="flex items-center gap-3 rounded-2xl bg-[#1b1b1b]/60 p-2 opacity-80"
                      >
                        <div className="size-11 shrink-0 overflow-hidden rounded-xl bg-[#222222]">
                          <TrackArtwork
                            className="size-full object-cover"
                            size={44}
                            iconSize={20}
                            artworkUrl={track.artworkUrl}
                          />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="line-clamp-1 text-sm font-medium text-white">
                            {track.title}
                          </span>
                          <span className="text-xs text-[#929292]">{track.artist}</span>
                        </div>
                        <span className="text-xs font-light text-[#cfe86a]">
                          {isActive
                            ? downloadProgress !== null
                              ? `${downloadProgress}%`
                              : "Downloading"
                            : "Queued"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Finished downloads list */}
            {downloads.length > 0 ? (
              <div className="flex flex-col gap-1">
                {downloads.map((entry) => {
                  const track = entry.track;
                  const isTrackPlaying = currentTrackId === track.id && isPlaying;
                  const isTrackCurrent = currentTrackId === track.id;
                  const allTracks = downloads.map((d) => d.track);

                  return (
                    <div
                      key={track.id}
                      className={cn(
                        "group flex items-center gap-3 rounded-2xl p-2 transition-colors active:bg-[#222222]",
                        isTrackCurrent ? "bg-[#1b1b1b]" : "hover:bg-[#181818]",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onPlayTrack(track, allTracks)}
                        aria-label={`Play ${track.title}`}
                        className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-[#222222] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                      >
                        <TrackArtwork
                          className="size-full object-cover"
                          size={48}
                          iconSize={22}
                          artworkUrl={track.artworkUrl}
                        />
                        {isTrackPlaying ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                            <MusicVisualizer bars={4} className="[--music-gap:2px] [--music-height:13px] [--music-width:15px]" />
                          </div>
                        ) : (
                          <div className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                            <PlayActiveIcon size={16} />
                          </div>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onPlayTrack(track, allTracks)}
                        className="flex min-w-0 flex-1 flex-col text-left focus-visible:outline-none"
                      >
                        <span
                          className={cn(
                            "line-clamp-1 text-sm font-medium",
                            isTrackCurrent ? "text-[#cfe86a]" : "text-white",
                          )}
                        >
                          {track.title}
                        </span>
                        <span className="line-clamp-1 text-xs font-light text-[#929292]">
                          {track.artist}
                        </span>
                      </button>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-xs font-light tabular-nums text-[#727272]">
                          {formatBytes(entry.byteLength)}
                        </span>
                        <RoundButton
                          label={`Options for ${track.title}`}
                          onClick={(e) => onTrackMenu(e, track)}
                          className="size-9 bg-transparent text-[#929292] hover:bg-[#252525] hover:text-white"
                        >
                          <MoreGlyph />
                        </RoundButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-16 text-center text-sm font-light text-[#929292]">
                No music downloaded yet. Save songs or albums to play them offline.
              </p>
            )}
          </div>
        ) : isLoading || page === null ? (
          <div className="flex flex-col gap-8">
            {[0, 1].map((shelfIdx) => (
              <div key={shelfIdx} className="flex flex-col gap-4">
                <div className="h-6 w-36 animate-pulse rounded bg-[#1b1b1b]" />
                <ShelfRow label="Loading">
                  {[0, 1, 2].map((slot) => (
                    <CoverCardSkeleton key={slot} layout="shelf" />
                  ))}
                </ShelfRow>
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="py-16 text-center text-sm font-light text-[#929292]">{error}</p>
        ) : page.shelves.length === 0 ? (
          <p className="py-16 text-center text-sm font-light text-[#929292]">
            No content available for this feed.
          </p>
        ) : (
          /* Render browse shelves */
          page.shelves.map((shelf, shelfIndex) => (
            <ShelfBlock
              key={`${shelf.title}-${shelfIndex}`}
              shelf={shelf}
              currentTrackId={currentTrackId}
              isPlaying={isPlaying}
              onPlayTrack={onPlayTrack}
              onTrackMenu={onTrackMenu}
              onOpenAlbum={onOpenAlbum}
              onOpenArtist={onOpenArtist}
              onOpenPlaylist={onOpenPlaylist}
              onFollowLink={onDrillDown}
            />
          ))
        )}
      </main>
    </div>
  );
}

/** One shelf of mixed content (albums, tracks, playlists, artists, chips) */
function ShelfBlock({
  shelf,
  currentTrackId,
  isPlaying,
  onPlayTrack,
  onTrackMenu,
  onOpenAlbum,
  onOpenArtist,
  onOpenPlaylist,
  onFollowLink,
}: {
  shelf: BrowseShelf;
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track, queue: readonly Track[]) => void;
  onTrackMenu: (event: MouseEvent<HTMLElement>, track: Track) => void;
  onOpenAlbum: (album: Album) => void;
  onOpenArtist: (artist: Artist) => void;
  onOpenPlaylist: (playlist: Playlist) => void;
  onFollowLink: (link: { browseId: string; title: string; params?: string }) => void;
}) {
  const hasAlbumsOrPlaylists = shelf.albums.length > 0 || shelf.playlists.length > 0;
  const hasTracks = shelf.tracks.length > 0;
  const hasArtists = shelf.artists.length > 0;
  const hasLinks = shelf.links && shelf.links.length > 0;

  if (!hasAlbumsOrPlaylists && !hasTracks && !hasArtists && !hasLinks) return null;

  return (
    <section className="flex flex-col gap-4">
      {shelf.title && (
        <h2 className="text-xl font-medium tracking-normal text-[#e7e7e7]">{shelf.title}</h2>
      )}

      {/* Moods / Genre chips */}
      {hasLinks && (
        <div className="grid grid-cols-2 gap-2.5">
          {shelf.links.map((chip) => (
            <button
              key={chip.browseId}
              type="button"
              onClick={() => onFollowLink(chip)}
              className="flex h-14 items-center justify-between rounded-2xl bg-[#1b1b1b] px-4 text-left font-medium text-white transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <span className="line-clamp-1 text-sm">{chip.title}</span>
              <span className="text-[#929292]">→</span>
            </button>
          ))}
        </div>
      )}

      {/* Tracks list (e.g. Charts) */}
      {hasTracks && (
        <div className="flex flex-col gap-1">
          {shelf.tracks.map((track, trackIndex) => {
            const isTrackPlaying = currentTrackId === track.id && isPlaying;
            const isTrackCurrent = currentTrackId === track.id;

            return (
              <div
                key={track.id}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl p-2 transition-colors active:bg-[#222222]",
                  isTrackCurrent ? "bg-[#1b1b1b]" : "hover:bg-[#181818]",
                )}
              >
                <span className="w-5 text-center text-xs font-light tabular-nums text-[#727272]">
                  {trackIndex + 1}
                </span>

                <button
                  type="button"
                  onClick={() => onPlayTrack(track, shelf.tracks)}
                  aria-label={`Play ${track.title}`}
                  className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-[#222222] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <TrackArtwork
                    className="size-full object-cover"
                    size={48}
                    iconSize={22}
                    artworkUrl={track.artworkUrl}
                  />
                  {isTrackPlaying ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <MusicVisualizer bars={4} className="[--music-gap:2px] [--music-height:13px] [--music-width:15px]" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                      <PlayActiveIcon size={16} />
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onPlayTrack(track, shelf.tracks)}
                  className="flex min-w-0 flex-1 flex-col text-left focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "line-clamp-1 text-sm font-medium",
                      isTrackCurrent ? "text-[#cfe86a]" : "text-white",
                    )}
                  >
                    {track.title}
                  </span>
                  <span className="line-clamp-1 text-xs font-light text-[#929292]">
                    {track.artist}
                  </span>
                </button>

                <div className="flex shrink-0 items-center gap-1.5">
                  {track.durationSec ? (
                    <span className="text-xs font-light tabular-nums text-[#727272]">
                      {formatTrackDuration(track.durationSec)}
                    </span>
                  ) : null}
                  <RoundButton
                    label={`Options for ${track.title}`}
                    onClick={(e) => onTrackMenu(e, track)}
                    className="size-9 bg-transparent text-[#929292] hover:bg-[#252525] hover:text-white"
                  >
                    <MoreGlyph />
                  </RoundButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Artists row */}
      {hasArtists && (
        <div className="-mx-5 flex gap-4 overflow-x-auto px-5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {shelf.artists.map((artist) => (
            <button
              key={artist.id}
              type="button"
              onClick={() => onOpenArtist(artist)}
              className="flex w-24 shrink-0 flex-col items-center text-center transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <div className="size-20 overflow-hidden rounded-full shadow-[0_6px_20px_rgba(0,0,0,0.5)]">
                <TrackArtwork
                  className="size-full object-cover"
                  size={80}
                  iconSize={36}
                  artworkUrl={artist.artworkUrl}
                  variant="artist"
                />
              </div>
              <span className="mt-2 line-clamp-1 w-full text-xs font-medium text-[#e7e7e7]">
                {artist.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Albums and Playlists horizontal shelf */}
      {hasAlbumsOrPlaylists && (
        <ShelfRow label={shelf.title || "Items"}>
          {shelf.albums.map((album) => (
            <CoverCard
              key={album.id}
              layout="shelf"
              title={album.title}
              subtitle={album.artist}
              artworkUrl={album.artworkUrl}
              variant="album"
              onOpen={() => onOpenAlbum(album)}
            />
          ))}
          {shelf.playlists.map((playlist) => (
            <CoverCard
              key={playlist.id}
              layout="shelf"
              title={playlist.title}
              subtitle={playlist.owner}
              artworkUrl={playlist.artworkUrl}
              variant="playlist"
              onOpen={() => onOpenPlaylist(playlist)}
            />
          ))}
        </ShelfRow>
      )}
    </section>
  );
}
