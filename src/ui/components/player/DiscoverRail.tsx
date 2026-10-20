import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { PlayActiveIcon } from "@/ui/icons";
import type { Artist, Track } from "../../../datasource/types";
import { isOnline, useOnline } from "../../../internal/connectivity";
import { usePlayHistory } from "../../../player/playHistory";
import {
  libraryController,
  playerController,
  shallowEqual,
  useLibraryState,
  usePlayerSelector,
} from "../../../player/playerStore";
import { buildTasteProfile, normalizeArtist } from "../../../player/taste";
import { ArtistLinks, useNavigateArtist } from "../ArtistLinks";
import { TrackArtwork } from "../TrackArtwork";

const EMPTY_TRACKS: Track[] = [];
/** Artists listed under "Top Artists". The design shows four. */
const TOP_ARTIST_COUNT = 4;

/** Answers outlive the panel: it unmounts whenever the queue is closed, and each lookup is a request. */
const recommendationCache = new Map<string, Track[]>();
const artistCache = new Map<string, Artist | null>();

function SectionTitle({ children }: { children: string }) {
  return <h3 className="px-1 font-lexend text-lg font-light tracking-wide text-foreground">{children}</h3>;
}

/**
 * "Recommended" and "Top Artists" at the head of the right rail.
 *
 * Both are derived from what the listener already does, with no new backend: the first is the
 * top of `getRecommendations` for the song playing (or, with nothing playing, the strongest
 * track in the taste profile); the second is the taste profile's favourite artists, resolved to
 * a photo and subscriber count through an artist search. Either section simply stays out of the
 * way when it has nothing — offline, signed out, or no listening history yet.
 */
export function DiscoverRail() {
  const online = useOnline();
  const playHistory = usePlayHistory();
  const libraryState = useLibraryState();
  const currentTrack = usePlayerSelector((player) => player.currentTrack, shallowEqual);

  const recentlyPlayed = libraryState.library?.recentlyPlayed ?? EMPTY_TRACKS;
  const likedSongs = libraryState.library?.likedSongs ?? EMPTY_TRACKS;
  const taste = useMemo(
    () => buildTasteProfile(playHistory, likedSongs, recentlyPlayed),
    [playHistory, likedSongs, recentlyPlayed],
  );

  // --- Recommended -------------------------------------------------------------------------
  const seed = currentTrack ?? taste.weightedTracks[0]?.track ?? recentlyPlayed[0];
  const seedId = seed?.id;
  const [recommended, setRecommended] = useState<Track[]>([]);

  useEffect(() => {
    if (!seed || !online) {
      setRecommended([]);
      return;
    }
    const cached = recommendationCache.get(seed.id);
    if (cached) {
      setRecommended(cached);
      return;
    }
    let cancelled = false;
    void libraryController
      .getRecommendations(seed)
      .then((tracks) => {
        if (isOnline()) recommendationCache.set(seed.id, tracks);
        if (!cancelled) setRecommended(tracks);
      })
      .catch(() => {
        if (!cancelled) setRecommended([]);
      });
    return () => {
      cancelled = true;
    };
    // Keyed on the id: the track object is replaced by metadata refreshes that change nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedId, online]);

  const pick = useMemo(
    () => recommended.find((track) => track.id !== currentTrack?.id && !taste.justPlayed.has(track.id)),
    [recommended, currentTrack?.id, taste.justPlayed],
  );

  // --- Top artists -------------------------------------------------------------------------
  const topNames = taste.topArtists.slice(0, TOP_ARTIST_COUNT);
  const topKey = topNames.join("|");
  const [artists, setArtists] = useState<Artist[]>([]);

  useEffect(() => {
    if (!online || topNames.length === 0) {
      setArtists([]);
      return;
    }
    let cancelled = false;
    void Promise.all(
      topNames.map(async (name): Promise<Artist | null> => {
        const key = normalizeArtist(name);
        if (artistCache.has(key)) return artistCache.get(key) ?? null;
        try {
          const { artists: found } = await libraryController.searchCategory(name, "artist");
          // An exact name only: the first search hit for a name can be a different act entirely.
          const match = found.find((artist) => normalizeArtist(artist.name) === key) ?? null;
          if (isOnline()) artistCache.set(key, match);
          return match;
        } catch {
          return null;
        }
      }),
    ).then((resolved) => {
      if (cancelled) return;
      setArtists(resolved.filter((artist): artist is Artist => artist !== null));
    });
    return () => {
      cancelled = true;
    };
    // `topKey` is the stable form of `topNames`, which is a fresh array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topKey, online]);

  const navigateArtist = useNavigateArtist();

  if (!pick && artists.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-col gap-4 px-2 pb-3 pt-1">
      {pick && (
        <section className="flex flex-col gap-2" aria-label="Recommended">
          <SectionTitle>Recommended</SectionTitle>
          <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.1] p-2">
            <TrackArtwork className="size-11 shrink-0 rounded-lg" size={44} artworkUrl={pick.artworkUrl} iconSize={18} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-foreground">{pick.title}</span>
              <ArtistLinks
                className="truncate text-xs text-muted-foreground"
                artists={pick.artists}
                fallback={pick.artist}
              />
            </span>
            <button
              type="button"
              aria-label={`Play ${pick.title}`}
              onClick={() => void playerController.playTrackById(pick.id, recommended, true)}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-neutral-900 shadow-md shadow-black/20 transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <PlayActiveIcon size={18} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {artists.length > 0 && (
        <section className="flex flex-col gap-1" aria-label="Top artists">
          <SectionTitle>Top Artists</SectionTitle>
          <ul className="flex flex-col">
            {artists.map((artist) => (
              <li key={artist.id}>
                <button
                  type="button"
                  disabled={!navigateArtist}
                  onClick={(event) => navigateArtist?.(artist, event.shiftKey || event.ctrlKey || event.metaKey)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition-colors",
                    "hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <TrackArtwork
                    className="size-10 shrink-0 rounded-lg"
                    size={40}
                    artworkUrl={artist.artworkUrl}
                    iconSize={16}
                    variant="artist"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-foreground">{artist.name}</span>
                    {artist.subscriberCount && (
                      <span className="truncate text-[11px] text-muted-foreground">{artist.subscriberCount}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
