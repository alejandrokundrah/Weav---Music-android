import {
  type MouseEvent,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { MusicVisualizer, SpinnerSteps } from "@/components/motion/loader";
import { ArrowLeftIcon, CloseIcon, PlayActiveIcon } from "@/ui/icons";
import type {
  Album,
  Artist,
  Playlist,
  SearchResults,
  Track,
} from "../../datasource/types";
import { CoverCard, ShelfRow } from "../components/phone/CoverCard";
import { MoreGlyph, RoundButton } from "../components/phone/PhoneControls";
import { PhoneSearchIcon } from "../components/phone/PhoneIcons";
import { TrackArtwork } from "../components/TrackArtwork";
import { formatTrackDuration } from "./formatTrackDuration";

export type SearchScope = "all" | "songs" | "artists" | "albums" | "playlists";

export interface PhoneSearchProps {
  query: string;
  onQueryChange?: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
  isLoading: boolean;
  isDeepLoading?: boolean;
  scope: SearchScope;
  onScopeChange: (scope: SearchScope) => void;
  availableScopes: ReadonlyArray<{ value: SearchScope; label: string; count?: number }>;
  scopedResults: SearchResults;
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track) => void;
  onTrackMenu: (event: MouseEvent<HTMLElement>, track: Track) => void;
  onOpenArtist: (artist: Artist) => void;
  onOpenAlbum: (album: Album) => void;
  onOpenPlaylist: (playlist: Playlist) => void;
  onBack?: () => void;
}

/**
 * The phone's search results page:
 * - Pure #131313 canvas with 20px gutters and safe-area top inset
 * - Touch-friendly search bar in #1B1B1B with clear action
 * - Horizontal scrolling category pills
 * - Horizontal cover shelves for artists, albums, and playlists on the "all" view
 * - High-contrast touchable song list rows with artwork and more-menu buttons
 * - 2-column cover grids on dedicated category views
 */
export function PhoneSearch({
  query,
  onQueryChange,
  onSearchSubmit,
  isLoading,
  isDeepLoading,
  scope,
  onScopeChange,
  availableScopes,
  scopedResults,
  currentTrackId,
  isPlaying,
  onPlayTrack,
  onTrackMenu,
  onOpenArtist,
  onOpenAlbum,
  onOpenPlaylist,
  onBack,
}: PhoneSearchProps) {
  const [localQuery, setLocalQuery] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = localQuery.trim();
    if (trimmed && onSearchSubmit) {
      onSearchSubmit(trimmed);
      inputRef.current?.blur();
    }
  };

  const handleClear = () => {
    setLocalQuery("");
    onQueryChange?.("");
    inputRef.current?.focus();
  };

  const hasAnyResults =
    scopedResults.artists.length > 0 ||
    scopedResults.tracks.length > 0 ||
    scopedResults.albums.length > 0 ||
    scopedResults.playlists.length > 0;

  return (
    <div className="flex min-h-full flex-col bg-[#131313] px-5 pb-28 pt-2 font-lexend text-[#e7e7e7]">
      {/* Mobile Search Header */}
      <header className="flex flex-col gap-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[#1b1b1b] text-[#e7e7e7] transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <ArrowLeftIcon size={18} aria-hidden="true" />
            </button>
          )}

          <div className="relative flex h-11 min-w-0 flex-1 items-center rounded-2xl bg-[#1b1b1b] px-3.5 text-[#e7e7e7] transition-colors focus-within:ring-2 focus-within:ring-white/25">
            <span className="shrink-0 text-[#929292]">
              <PhoneSearchIcon size={20} />
            </span>
            <input
              ref={inputRef}
              type="search"
              value={localQuery}
              onChange={(e) => {
                setLocalQuery(e.target.value);
                onQueryChange?.(e.target.value);
              }}
              placeholder="Search songs, artists, albums..."
              className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm font-light text-white outline-none placeholder:text-[#727272]"
              aria-label="Search query"
            />
            {localQuery.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear search"
                className="grid size-7 place-items-center rounded-full text-[#929292] transition-colors hover:text-white"
              >
                <CloseIcon size={16} />
              </button>
            )}
          </div>
        </form>

        {/* Filter scopes row */}
        {availableScopes.length > 1 && (
          <div
            role="tablist"
            aria-label="Filter results"
            className="-mx-5 flex items-center gap-2 overflow-x-auto px-5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {availableScopes.map((item) => {
              const selected = scope === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => onScopeChange(item.value)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-light transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                    selected
                      ? "bg-white font-medium text-[#131313] shadow-[0_2px_12px_rgba(255,255,255,0.2)]"
                      : "bg-[#1b1b1b] text-[#929292] hover:text-[#e7e7e7]",
                  )}
                >
                  <span>{item.label}</span>
                  {typeof item.count === "number" && item.count > 0 && item.value !== "all" && (
                    <span className={cn("tabular-nums text-[10px]", selected ? "text-[#131313]/70" : "text-[#727272]")}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="mt-5 flex flex-col gap-8">
        {isLoading || (isDeepLoading && !hasAnyResults) ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#929292]" role="status">
            <SpinnerSteps size={32} color="#ffffff" />
            <p className="mt-3 text-sm font-light">Searching...</p>
          </div>
        ) : !hasAnyResults ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-base font-light text-[#929292]">
              {query ? `No results for "${query}"` : "Search for music, artists or albums."}
            </p>
          </div>
        ) : (
          <>
            {/* Artists Section */}
            {scopedResults.artists.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-xl font-medium tracking-normal text-[#e7e7e7]">Artists</h2>
                {scope === "artists" ? (
                  <div className="grid grid-cols-2 gap-3.5">
                    {scopedResults.artists.map((artist) => (
                      <button
                        key={artist.id}
                        type="button"
                        onClick={() => onOpenArtist(artist)}
                        className="flex flex-col items-center rounded-2xl bg-[#1b1b1b] p-4 text-center transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                      >
                        <div className="size-28 overflow-hidden rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
                          <TrackArtwork
                            className="size-full object-cover"
                            size={112}
                            iconSize={48}
                            artworkUrl={artist.artworkUrl}
                            variant="artist"
                          />
                        </div>
                        <span className="mt-3 line-clamp-1 w-full text-sm font-medium text-white">
                          {artist.name}
                        </span>
                        <span className="mt-0.5 text-xs font-light text-[#929292]">
                          {artist.subscriberCount || "Artist"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="-mx-5 flex gap-4 overflow-x-auto px-5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {scopedResults.artists.map((artist) => (
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
              </section>
            )}

            {/* Songs Section */}
            {scopedResults.tracks.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <h2 className="text-xl font-medium tracking-normal text-[#e7e7e7]">Songs</h2>
                <div className="flex flex-col gap-1">
                  {scopedResults.tracks.map((track) => {
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
                        {/* Artwork with play state */}
                        <button
                          type="button"
                          onClick={() => onPlayTrack(track)}
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
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 [--color-primary:#cfe86a]">
                              <MusicVisualizer
                                bars={4}
                                className="[--music-gap:2px] [--music-height:13px] [--music-width:15px]"
                              />
                            </div>
                          ) : (
                            <div className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                              <PlayActiveIcon size={16} />
                            </div>
                          )}
                        </button>

                        {/* Title & Artist */}
                        <button
                          type="button"
                          onClick={() => onPlayTrack(track)}
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
                            {track.artist || (track.artists && track.artists.map((a) => a.name).join(", "))}
                          </span>
                        </button>

                        {/* Duration & More options */}
                        <div className="flex shrink-0 items-center gap-1.5">
                          {track.durationSec ? (
                            <span className="text-xs font-light tabular-nums text-[#727272]">
                              {formatTrackDuration(track.durationSec)}
                            </span>
                          ) : null}
                          <RoundButton
                            label={`Options for ${track.title}`}
                            onClick={(event) => onTrackMenu(event, track)}
                            className="size-9 bg-transparent text-[#929292] hover:bg-[#252525] hover:text-white"
                          >
                            <MoreGlyph />
                          </RoundButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Albums Section */}
            {scopedResults.albums.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-xl font-medium tracking-normal text-[#e7e7e7]">Albums</h2>
                {scope === "albums" ? (
                  <div className="grid grid-cols-2 gap-3.5">
                    {scopedResults.albums.map((album) => (
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
                  </div>
                ) : (
                  <ShelfRow label="Albums">
                    {scopedResults.albums.map((album) => (
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
                  </ShelfRow>
                )}
              </section>
            )}

            {/* Playlists Section */}
            {scopedResults.playlists.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-xl font-medium tracking-normal text-[#e7e7e7]">Playlists</h2>
                {scope === "playlists" ? (
                  <div className="grid grid-cols-2 gap-3.5">
                    {scopedResults.playlists.map((playlist) => (
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
                  </div>
                ) : (
                  <ShelfRow label="Playlists">
                    {scopedResults.playlists.map((playlist) => (
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
            )}
          </>
        )}
      </main>
    </div>
  );
}
