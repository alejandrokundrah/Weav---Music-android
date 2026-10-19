import type { CSSProperties, MouseEvent } from "react";
import type { Album, Artist, Playlist, SearchResults, Track } from "../../datasource/types";
import { CoverCard, ShelfRow } from "../components/phone/CoverCard";
import {
  PhoneArtistBubble,
  PhoneHeading,
  PhoneNotice,
  PhoneScroller,
  PhoneSection,
  PhoneSongRow,
  PhoneTabs,
  type PhoneTab,
} from "../components/phone/PhoneParts";
import { useNowPlaying } from "../hooks/useNowPlaying";

export type PhoneSearchScope = "all" | "songs" | "artists" | "albums" | "playlists";

export interface PhoneSearchResultsProps {
  query: string;
  isLoading: boolean;
  /** Only the scopes that have something in them, "all" first. */
  scopes: ReadonlyArray<PhoneTab<PhoneSearchScope>>;
  scope: PhoneSearchScope;
  onScopeChange: (scope: PhoneSearchScope) => void;
  results: SearchResults;
  /** Songs lead when the query matches a song title exactly and no artist name. */
  songsFirst: boolean;
  onPlayTrack: (track: Track) => void;
  onTrackMenu: (event: MouseEvent<HTMLElement>, track: Track) => void;
  onOpenArtist: (artist: Artist) => void;
  onOpenAlbum: (album: Album) => void;
  onPlayAlbum: (album: Album) => void;
  onAlbumMenu: (event: MouseEvent<HTMLElement>, album: Album) => void;
  onOpenPlaylist: (playlist: Playlist) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onPlaylistMenu: (event: MouseEvent<HTMLElement>, playlist: Playlist) => void;
}

/**
 * The phone's search results: the query as a heading, a text switch for the category, and the
 * four kinds of result in the same shapes the rest of the phone app uses — round portraits for
 * artists, song rows, cover cards for albums and playlists.
 *
 * Presentational only. `SearchResultsPage` still owns the search, the category deep-search and
 * which results are on screen, so the phone and desktop pages cannot disagree about results.
 */
export function PhoneSearchResults(props: PhoneSearchResultsProps) {
  const { query, isLoading, scopes, scope, results, songsFirst } = props;
  const { currentTrackId } = useNowPlaying();
  const focused = scope !== "all";
  const total =
    results.artists.length + results.tracks.length + results.albums.length + results.playlists.length;

  return (
    <div
      className="font-lexend flex flex-col pb-8 pt-1 text-white"
      style={{ "--card-w": "min(51vw, 15rem)" } as CSSProperties}
    >
      <header className="flex flex-col gap-1">
        <span className="text-base font-extralight leading-5 text-[#929292]">Results for</span>
        <PhoneHeading className="break-words">{query}</PhoneHeading>
      </header>

      {/* Only offered when there is something to narrow to. */}
      {!isLoading && scopes.length > 2 && (
        <PhoneTabs
          className="mt-6"
          label="Filter results"
          tabs={scopes}
          value={scope}
          onChange={props.onScopeChange}
        />
      )}

      {isLoading ? (
        <div className="mt-8 flex flex-col gap-3" role="status" aria-label="Searching">
          {[0, 1, 2, 3, 4, 5].map((slot) => (
            <div key={slot} className="h-[68px] animate-pulse rounded-2xl bg-[#1b1b1b]" />
          ))}
        </div>
      ) : total === 0 ? (
        <PhoneNotice>No results found.</PhoneNotice>
      ) : (
        <div className="flex flex-col">
          {results.artists.length > 0 && (
            <div style={{ order: songsFirst ? 1 : 0 }}>
              <PhoneSection title="Artists">
                {focused ? (
                  <div className="grid grid-cols-3 gap-y-6">
                    {results.artists.map((artist) => (
                      <PhoneArtistBubble
                        key={artist.id}
                        artist={artist}
                        caption={artist.subscriberCount}
                        className="w-full"
                        onOpen={() => props.onOpenArtist(artist)}
                      />
                    ))}
                  </div>
                ) : (
                  <PhoneScroller label="Artists">
                    {results.artists.map((artist) => (
                      <PhoneArtistBubble
                        key={artist.id}
                        artist={artist}
                        caption={artist.subscriberCount}
                        onOpen={() => props.onOpenArtist(artist)}
                      />
                    ))}
                  </PhoneScroller>
                )}
              </PhoneSection>
            </div>
          )}

          {results.tracks.length > 0 && (
            <div style={{ order: songsFirst ? 0 : 1 }}>
              <PhoneSection title="Songs">
                <div className="flex flex-col gap-1" data-onboarding="search-results">
                  {results.tracks.map((track) => (
                    <PhoneSongRow
                      key={track.id}
                      track={track}
                      isCurrent={track.id === currentTrackId}
                      onSelect={() => props.onPlayTrack(track)}
                      onMenu={(event) => props.onTrackMenu(event, track)}
                    />
                  ))}
                </div>
              </PhoneSection>
            </div>
          )}

          {results.albums.length > 0 && (
            <div style={{ order: 2 }}>
              <PhoneSection title="Albums">
                {focused ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-8">
                    {results.albums.map((album) => (
                      <AlbumCover key={album.id} album={album} {...props} />
                    ))}
                  </div>
                ) : (
                  <ShelfRow label="Albums">
                    {results.albums.map((album) => (
                      <AlbumCover key={album.id} album={album} {...props} />
                    ))}
                  </ShelfRow>
                )}
              </PhoneSection>
            </div>
          )}

          {results.playlists.length > 0 && (
            <div style={{ order: 3 }}>
              <PhoneSection title="Playlists">
                {focused ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-8">
                    {results.playlists.map((playlist) => (
                      <PlaylistCover key={playlist.id} playlist={playlist} {...props} />
                    ))}
                  </div>
                ) : (
                  <ShelfRow label="Playlists">
                    {results.playlists.map((playlist) => (
                      <PlaylistCover key={playlist.id} playlist={playlist} {...props} />
                    ))}
                  </ShelfRow>
                )}
              </PhoneSection>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AlbumCover({ album, ...props }: { album: Album } & PhoneSearchResultsProps) {
  return (
    <CoverCard
      layout="shelf"
      title={album.title}
      subtitle={album.artist}
      artworkUrl={album.artworkUrl}
      variant="album"
      onOpen={() => props.onOpenAlbum(album)}
      onPlay={() => props.onPlayAlbum(album)}
      onContextMenu={(event) => props.onAlbumMenu(event, album)}
    />
  );
}

function PlaylistCover({
  playlist,
  ...props
}: { playlist: Playlist } & PhoneSearchResultsProps) {
  return (
    <CoverCard
      layout="shelf"
      title={playlist.title}
      subtitle={playlist.owner}
      artworkUrl={playlist.artworkUrl}
      variant="playlist"
      onOpen={() => props.onOpenPlaylist(playlist)}
      onPlay={() => props.onPlayPlaylist(playlist)}
      onContextMenu={(event) => props.onPlaylistMenu(event, playlist)}
    />
  );
}
