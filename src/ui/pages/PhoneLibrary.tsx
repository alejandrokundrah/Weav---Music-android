import {
  type MouseEvent,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { MusicVisualizer } from "@/components/motion/loader";
import { CloseIcon, PlayActiveIcon, SearchIcon } from "@/ui/icons";
import type { Album, Artist, Playlist, Track } from "../../datasource/types";
import { CoverCard } from "../components/phone/CoverCard";
import {
  MoreGlyph,
  RoundButton,
  ShuffleGlyph,
} from "../components/phone/PhoneControls";
import { GlassPlayGlyph } from "../components/phone/PhoneIcons";
import { TrackArtwork } from "../components/TrackArtwork";
import { isLikedSongsId, likedSongsCover } from "../likedSongsArtwork";
import { formatTrackDuration } from "./formatTrackDuration";

export type LibraryTab = "playlists" | "songs" | "albums" | "artists";
export type LibrarySort = "recent" | "title" | "artist";

export interface PhoneLibraryProps {
  tab: LibraryTab;
  onTabChange: (tab: LibraryTab) => void;
  query: string;
  onQueryChange: (query: string) => void;
  sort: LibrarySort;
  onSortChange: (sort: LibrarySort) => void;
  songs: readonly Track[];
  albums: readonly Album[];
  artists: readonly Artist[];
  playlists: readonly Playlist[];
  counts: Record<LibraryTab, number>;
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlaySong: (track: Track, queue: readonly Track[]) => void;
  onShuffleSongs: () => void;
  onTrackMenu: (event: MouseEvent<HTMLElement>, track: Track) => void;
  onOpenAlbum: (album: Album) => void;
  onOpenArtist: (artist: Artist) => void;
  onOpenPlaylist: (playlist: Playlist) => void;
  onPlaylistMenu: (event: MouseEvent<HTMLElement>, playlist: Playlist) => void;
  onAlbumMenu: (event: MouseEvent<HTMLElement>, album: Album) => void;
}

const TABS: ReadonlyArray<{ value: LibraryTab; label: string }> = [
  { value: "playlists", label: "Playlists" },
  { value: "songs", label: "Songs" },
  { value: "albums", label: "Albums" },
  { value: "artists", label: "Artists" },
];

const SORTS: ReadonlyArray<{ value: LibrarySort; label: string }> = [
  { value: "recent", label: "Recent" },
  { value: "title", label: "Title" },
  { value: "artist", label: "Artist" },
];

/**
 * Phone Library screen ("My Music"):
 * - Deep #131313 canvas, Lexend typography
 * - Clean category pills (Playlists, Songs, Albums, Artists)
 * - Pinned "Liked Songs" card with warm gradient bloom
 * - Touch-sized track rows and 2-column cover card grids
 * - Integrated filter & sort controls
 */
export function PhoneLibrary({
  tab,
  onTabChange,
  query,
  onQueryChange,
  sort,
  onSortChange,
  songs,
  albums,
  artists,
  playlists,
  counts,
  currentTrackId,
  isPlaying,
  onPlaySong,
  onShuffleSongs,
  onTrackMenu,
  onOpenAlbum,
  onOpenArtist,
  onOpenPlaylist,
  onPlaylistMenu,
  onAlbumMenu,
}: PhoneLibraryProps) {
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const likedPlaylist = playlists.find((p) => isLikedSongsId(p.id));
  const otherPlaylists = playlists.filter((p) => !isLikedSongsId(p.id));

  return (
    <div className="flex min-h-full flex-col bg-[#131313] px-5 pb-28 pt-2 font-lexend text-[#e7e7e7]">
      {/* Header */}
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-[28px] font-semibold leading-tight tracking-normal text-white">
            My Music
          </h1>

          <button
            type="button"
            onClick={() => {
              setShowSearch((prev) => !prev);
              if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            aria-label="Filter library"
            className={cn(
              "grid size-10 place-items-center rounded-full transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
              showSearch ? "bg-white text-[#131313]" : "bg-[#1b1b1b] text-[#e7e7e7]",
            )}
          >
            <SearchIcon size={18} />
          </button>
        </div>

        {/* Filter Input (Collapsible/Toggleable) */}
        {showSearch && (
          <div className="relative flex h-11 min-w-0 items-center rounded-2xl bg-[#1b1b1b] px-3.5 text-[#e7e7e7] transition-all">
            <SearchIcon size={17} className="shrink-0 text-[#929292]" />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={`Filter ${tab}...`}
              className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm font-light text-white outline-none placeholder:text-[#727272]"
              aria-label="Filter query"
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                aria-label="Clear filter"
                className="grid size-7 place-items-center rounded-full text-[#929292] hover:text-white"
              >
                <CloseIcon size={15} />
              </button>
            )}
          </div>
        )}

        {/* Category Tabs */}
        <div
          role="tablist"
          aria-label="Library sections"
          className="-mx-5 flex items-center gap-2 overflow-x-auto px-5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((item) => {
            const selected = tab === item.value;
            const count = counts[item.value];
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onTabChange(item.value)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-light transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                  selected
                    ? "bg-white font-medium text-[#131313] shadow-[0_2px_12px_rgba(255,255,255,0.2)]"
                    : "bg-[#1b1b1b] text-[#929292] hover:text-[#e7e7e7]",
                )}
              >
                <span>{item.label}</span>
                {count > 0 && (
                  <span className={cn("tabular-nums text-[10px]", selected ? "text-[#131313]/70" : "text-[#727272]")}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sort Chips */}
        <div className="flex items-center gap-2 pt-1 text-xs text-[#929292]">
          <span className="font-light">Sort:</span>
          {SORTS.map((s) => {
            if (tab === "artists" && s.value === "artist") return null;
            const isSelected = sort === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => onSortChange(s.value)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs transition-colors",
                  isSelected
                    ? "bg-[#2a2a2a] font-normal text-white"
                    : "bg-transparent font-light text-[#727272] hover:text-[#cdcdcd]",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="mt-6 flex flex-col gap-6">
        {/* PLAYLISTS VIEW */}
        {tab === "playlists" && (
          <div className="flex flex-col gap-5">
            {/* Pinned Liked Songs Card */}
            {likedPlaylist && !query && (
              <button
                type="button"
                onClick={() => onOpenPlaylist(likedPlaylist)}
                onContextMenu={(e) => onPlaylistMenu(e, likedPlaylist)}
                className="group relative flex items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-r from-[#2a171c] to-[#1b1b1b] p-4 text-left shadow-[0_12px_32px_rgba(255,0,51,0.18)] transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <div className="size-20 shrink-0 overflow-hidden rounded-2xl shadow-lg">
                  <img src={likedSongsCover} alt="" className="size-full object-cover" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-lg font-semibold text-white">Liked Songs</span>
                  <span className="mt-0.5 text-xs font-light text-[#cdcdcd]">
                    {counts.songs} songs · Auto-updated
                  </span>
                </div>
                <div className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition-transform group-hover:scale-105">
                  <GlassPlayGlyph size={44} />
                </div>
              </button>
            )}

            {/* Other Playlists Grid */}
            {otherPlaylists.length > 0 ? (
              <div className="grid grid-cols-2 gap-3.5">
                {otherPlaylists.map((playlist) => (
                  <CoverCard
                    key={playlist.id}
                    layout="shelf"
                    title={playlist.title}
                    subtitle={playlist.owner}
                    artworkUrl={playlist.artworkUrl}
                    variant="playlist"
                    onOpen={() => onOpenPlaylist(playlist)}
                    onContextMenu={(e) => onPlaylistMenu(e, playlist)}
                  />
                ))}
              </div>
            ) : !likedPlaylist ? (
              <p className="py-16 text-center text-sm font-light text-[#929292]">
                {query ? `No playlists match "${query}".` : "No playlists saved yet."}
              </p>
            ) : null}
          </div>
        )}

        {/* SONGS VIEW */}
        {tab === "songs" && (
          <div className="flex flex-col gap-4">
            {/* Play All & Shuffle Buttons */}
            {songs.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onPlaySong(songs[0], songs)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-medium text-[#131313] transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <GlassPlayGlyph size={24} />
                  <span>Play all</span>
                </button>
                <button
                  type="button"
                  onClick={onShuffleSongs}
                  aria-label="Shuffle songs"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#1b1b1b] text-white transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <ShuffleGlyph />
                </button>
              </div>
            )}

            {/* Song Rows */}
            {songs.length > 0 ? (
              <div className="flex flex-col gap-1">
                {songs.map((track) => {
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
                      <button
                        type="button"
                        onClick={() => onPlaySong(track, songs)}
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

                      <button
                        type="button"
                        onClick={() => onPlaySong(track, songs)}
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
            ) : (
              <p className="py-16 text-center text-sm font-light text-[#929292]">
                {query ? `No songs match "${query}".` : "No songs saved in library."}
              </p>
            )}
          </div>
        )}

        {/* ALBUMS VIEW */}
        {tab === "albums" && (
          <div className="flex flex-col gap-4">
            {albums.length > 0 ? (
              <div className="grid grid-cols-2 gap-3.5">
                {albums.map((album) => (
                  <CoverCard
                    key={album.id}
                    layout="shelf"
                    title={album.title}
                    subtitle={album.artist}
                    artworkUrl={album.artworkUrl}
                    variant="album"
                    onOpen={() => onOpenAlbum(album)}
                    onContextMenu={(e) => onAlbumMenu(e, album)}
                  />
                ))}
              </div>
            ) : (
              <p className="py-16 text-center text-sm font-light text-[#929292]">
                {query ? `No albums match "${query}".` : "No saved albums yet."}
              </p>
            )}
          </div>
        )}

        {/* ARTISTS VIEW */}
        {tab === "artists" && (
          <div className="flex flex-col gap-4">
            {artists.length > 0 ? (
              <div className="grid grid-cols-2 gap-3.5">
                {artists.map((artist) => (
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
                    <span className="mt-0.5 text-xs font-light text-[#929292]">Artist</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-16 text-center text-sm font-light text-[#929292]">
                {query ? `No artists match "${query}".` : "No saved artists yet."}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
