import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { PlayActiveIcon } from "@/ui/icons";
import { SquareAltArrowLeftIcon, SquareAltArrowRightIcon } from "@solar-icons/react/linear";
import type { Album, Playlist, Track } from "../../datasource/types";
import type { LibraryController, LibraryState } from "../../player/LibraryController";
import type { PlayerControllerActions } from "../../player/playerStore";
import type { SearchController } from "../../player/SearchController";
import { AlbumCard } from "../components/AlbumCard";
import { DiceCard } from "../components/DiceCard";
import { PickCard } from "../components/PickCard";
import { TrackArtwork } from "../components/TrackArtwork";
import { useTrackContextMenu } from "../components/TrackContextMenu";
import { HomeHero } from "../components/HomeHero";
import { HomeSection } from "../components/HomeSection";
import { ArtistLinks } from "../components/ArtistLinks";
import { usePlayHistory } from "../../player/playHistory";
import {
  buildTasteProfile,
  pickSeeds,
  rankByTaste,
  seedForArtist,
} from "../../player/taste";
import { useMadeForYouVisible } from "../settings/homeSections";
import { AlbumGridSkeleton, PickCardSkeleton, TrackRowSkeleton } from "../components/Skeleton";
import { TrackRow } from "../components/TrackRow";
import { useNowPlaying } from "../hooks/useNowPlaying";
import { useCompactViewport } from "../hooks/useCompactViewport";
import { PhoneHome } from "./PhoneHome";
import { cn } from "@/lib/utils";
import { isOnline, useOnline } from "../../internal/connectivity";
import { useOfflineEntries } from "../../player/offlineStore";

/** A "Because you listen to …" row on the phone Home. */
export interface PersonalShelf {
  title: string;
  tracks: Track[];
}

const FALLBACK_QUERIES = [
  "new music",
  "popular songs",
  "indie mix",
  "electronic mix",
  "late night music",
  "discover weekly",
];

/** Skeleton cards shown on the "Made for you" shelf while suggestions load. */
const PICKS_SKELETON_COUNT = 8;
/** How far the shelf's arrow buttons scroll it, as a fraction of its visible width. */
const SHELF_SCROLL_FRACTION = 0.85;

/** Where the desktop Home sends the person; the sidebar owns the rest of the navigation. */
export interface HomeDestinationHandlers {
  onOpenLibrary: () => void;
  onOpenBrowse: () => void;
  onOpenHistory: () => void;
  onOpenDownloads: () => void;
}

/*
 * How each section is sliced from the underlying lists — named rather than left as the literal
 * arguments to `.slice()`, so a skeleton can ask for exactly this many placeholders instead of a
 * second, hand-picked number that only happens to agree with the real count today.
 */
const RECENT_COMPACT_COUNT = 6;
const RECENT_LARGE_COUNT = 18;
const TOP_SUGGESTIONS_COUNT = 11;
/** Same size as "Listen again" — two rows of recommendations should read as two equal shelves. */
const MORE_SUGGESTIONS_COUNT = RECENT_LARGE_COUNT;

const suggestionCache = new Map<string, Track[]>();
const suggestionLoads = new Map<string, Promise<Track[]>>();
const EMPTY_TRACKS: Track[] = [];

/**
 * Cap on memoized suggestion sets.
 *
 * The key carries both the tab and a signature of the recently-played list, so a new entry
 * appears for every tab and again on every library refresh — and each holds 36 full tracks.
 * Unbounded, that grew for as long as the app stayed open.
 *
 * Insertion order gives LRU for free: reads re-insert, so eviction takes the coldest.
 */
const MAX_SUGGESTION_ENTRIES = 20;

function readSuggestionCache(key: string): Track[] | undefined {
  const hit = suggestionCache.get(key);
  if (hit === undefined) return undefined;
  suggestionCache.delete(key);
  suggestionCache.set(key, hit);
  return hit;
}

function writeSuggestionCache(key: string, tracks: Track[]): void {
  suggestionCache.delete(key);
  suggestionCache.set(key, tracks);

  for (const coldest of [...suggestionCache.keys()]) {
    if (suggestionCache.size <= MAX_SUGGESTION_ENTRIES) break;
    suggestionCache.delete(coldest);
  }
}

interface HomePageProps {
  tabId: string;
  playerController: PlayerControllerActions;
  libraryController: LibraryController;
  libraryState: LibraryState;
  searchController: SearchController;
  onSignIn: () => Promise<void>;
  destinations: HomeDestinationHandlers;
  /** Opens the search overlay; the phone Home has a search button in its header. */
  onOpenSearch?: () => void;
  /** The phone Home's cards open albums and playlists directly. */
  onOpenAlbum?: (album: Album) => void;
  onOpenPlaylist?: (playlist: Playlist) => void;
}

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function uniqueTracks(tracks: readonly Track[]): Track[] {
  return [...new Map(tracks.map((track) => [track.id, track])).values()];
}

export function HomePage({
  tabId,
  playerController,
  libraryController,
  libraryState,
  searchController,
  onSignIn,
  destinations,
  onOpenSearch,
  onOpenAlbum,
  onOpenPlaylist,
}: HomePageProps) {
  const { openTrackMenu } = useTrackContextMenu();
  const isPhone = useCompactViewport();
  const showMadeForYou = useMadeForYouVisible();
  const recentlyPlayed = useMemo(
    () => libraryState.library?.recentlyPlayed ?? EMPTY_TRACKS,
    [libraryState.library],
  );
  const recentTrackKey = recentlyPlayed.map((track) => track.id).join(":");
  /*
   * Computed before the state below, not after, so the initial render can read the cache under
   * the key writes actually use. It previously seeded from `tabId` alone — a key nothing ever
   * stored — so the memo never hit and Home opened on a spinner every single time, which is
   * the exact thing this cache exists to prevent.
   */
  const suggestionCacheKey = recentlyPlayed.length > 0
    ? `${tabId}:recent:${recentTrackKey}`
    : `${tabId}:${libraryState.status}:empty`;
  const [suggestions, setSuggestions] = useState<Track[]>(
    () => readSuggestionCache(suggestionCacheKey) ?? [],
  );
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(
    () => !suggestionCache.has(suggestionCacheKey),
  );
  const [isSurpriseSpinning, setIsSurpriseSpinning] = useState(false);
  const shelfRef = useRef<HTMLDivElement>(null);
  const loadIdRef = useRef(0);
  /*
   * What is shown as "Recently played": this session's plays first, then YouTube's history.
   * The library snapshot only refreshes on start-up, so on its own the row sat unchanged
   * however much you listened. Suggestions still seed from the snapshot alone — keying them
   * on the live list would refetch them after every song.
   */
  const playHistory = usePlayHistory();
  const recentPlays = useMemo(
    () => uniqueTracks([...playHistory.map((entry) => entry.track), ...recentlyPlayed]),
    [playHistory, recentlyPlayed],
  );
  const likedSongs = libraryState.library?.likedSongs ?? EMPTY_TRACKS;
  const taste = useMemo(
    () => buildTasteProfile(playHistory, likedSongs, recentlyPlayed),
    [playHistory, likedSongs, recentlyPlayed],
  );
  /* Read inside the load below, which is keyed on the recent list alone: a live profile in its
     deps would refetch the whole row after every song. */
  const tasteRef = useRef(taste);
  tasteRef.current = taste;
  const [personalShelves, setPersonalShelves] = useState<PersonalShelf[]>([]);
  const topArtistKey = taste.topArtists.slice(0, 2).join("|");
  const online = useOnline();
  const offlineEntries = useOfflineEntries();
  const downloads = useMemo(
    () => Object.values(offlineEntries)
      .sort((left, right) => right.downloadedAt - left.downloadedAt)
      .map((entry) => entry.track),
    [offlineEntries],
  );
  const { currentTrackId, isPlaying } = useNowPlaying();
  const isWaitingForLibrary = !libraryState.library
    && (
      libraryState.status === "restoring"
      || libraryState.status === "loading"
      || libraryState.status === "authorizing"
    );

  useEffect(() => {
    // Offline, every recommendation fails; `online` in the deps reloads them on reconnect.
    if (!online) return;
    if (isWaitingForLibrary) {
      loadIdRef.current += 1;
      setSuggestions([]);
      setIsLoadingSuggestions(true);
      return;
    }

    const cached = readSuggestionCache(suggestionCacheKey);
    if (cached) {
      setSuggestions(cached);
      setIsLoadingSuggestions(false);
      return;
    }

    const loadId = ++loadIdRef.current;
    setIsLoadingSuggestions(true);

    let loadPromise = suggestionLoads.get(suggestionCacheKey);
    if (!loadPromise) {
      loadPromise = (async () => {
        const profile = tasteRef.current;
        const seeds = profile.hasSignal
          ? pickSeeds(profile, 3)
          : shuffle(recentlyPlayed).slice(0, 3);
        let loaded: Track[] = [];

        if (seeds.length > 0) {
          const recommendationSets = await Promise.allSettled(
            seeds.map((seed) => libraryController.getRecommendations(seed)),
          );
          loaded = recommendationSets.flatMap((result) =>
            result.status === "fulfilled" ? result.value : []
          );
        }

        if (loaded.length < 12) {
          const favourite = profile.topArtists[0];
          const query = favourite
            ? `${favourite} mix`
            : FALLBACK_QUERIES[Math.floor(Math.random() * FALLBACK_QUERIES.length)];
          try {
            loaded.push(...await searchController.searchTracks(query));
          } catch {
            // Recent tracks still provide a useful offline fallback.
          }
        }

        return rankByTaste(uniqueTracks([...loaded, ...recentlyPlayed]), profile).slice(0, 36);
      })();
      suggestionLoads.set(suggestionCacheKey, loadPromise);
    }

    void loadPromise.then((loadedSuggestions) => {
      // A load that lost the network is a fallback, not a result worth keeping.
      if (isOnline()) writeSuggestionCache(suggestionCacheKey, loadedSuggestions);
      suggestionLoads.delete(suggestionCacheKey);
      if (loadId !== loadIdRef.current) return;
      setSuggestions(loadedSuggestions);
      setIsLoadingSuggestions(false);
    });
  }, [
    online,
    isWaitingForLibrary,
    libraryController,
    recentlyPlayed,
    searchController,
    suggestionCacheKey,
  ]);

  useEffect(() => {
    if (!online || !topArtistKey) {
      setPersonalShelves([]);
      return;
    }
    const profile = tasteRef.current;
    let cancelled = false;
    void Promise.all(
      topArtistKey.split("|").map(async (artist): Promise<PersonalShelf | null> => {
        const seed = seedForArtist(profile, artist);
        if (!seed) return null;
        const cacheKey = `because:${artist}`;
        let tracks = readSuggestionCache(cacheKey);
        if (!tracks) {
          tracks = await libraryController.getRecommendations(seed).catch(() => [] as Track[]);
          if (tracks.length > 0) writeSuggestionCache(cacheKey, tracks);
        }
        const fresh = tracks.filter((track) => !profile.justPlayed.has(track.id)).slice(0, 12);
        return fresh.length > 0 ? { title: `Because you listen to ${seed.artist}`, tracks: fresh } : null;
      }),
    ).then((shelves) => {
      if (!cancelled) setPersonalShelves(shelves.filter((shelf): shelf is PersonalShelf => shelf !== null));
    });
    return () => {
      cancelled = true;
    };
  }, [online, topArtistKey, libraryController]);

  const compactRecent = useMemo(
    () => recentPlays.slice(0, RECENT_COMPACT_COUNT),
    [recentPlays],
  );
  const largeRecent = useMemo(
    () => recentPlays.slice(RECENT_COMPACT_COUNT, RECENT_COMPACT_COUNT + RECENT_LARGE_COUNT),
    [recentPlays],
  );
  /* The hero is built around the top recommendation, so every shelf continues after it rather
     than showing the same song twice. */
  const heroPick: Track | undefined = suggestions[0];
  const shelfSuggestions = suggestions.slice(1);
  const topSuggestions = shelfSuggestions.slice(0, TOP_SUGGESTIONS_COUNT);
  const moreSuggestions = shelfSuggestions.slice(
    TOP_SUGGESTIONS_COUNT,
    TOP_SUGGESTIONS_COUNT + MORE_SUGGESTIONS_COUNT,
  );
  const surpriseSuggestions = shelfSuggestions.slice(TOP_SUGGESTIONS_COUNT);
  const accountName = libraryState.library?.account?.name?.trim().split(/\s+/)[0];

  const playTrack = (track: Track, queue: readonly Track[]) => {
    void playerController.playTrackById(track.id, queue, true);
  };

  const playSurprise = () => {
    if (surpriseSuggestions.length === 0 || isSurpriseSpinning) return;
    setIsSurpriseSpinning(true);
    window.setTimeout(() => {
      const selected = surpriseSuggestions[
        Math.floor(Math.random() * surpriseSuggestions.length)
      ];
      setIsSurpriseSpinning(false);
      playTrack(selected, surpriseSuggestions);
    }, 720);
  };

  const scrollShelf = (direction: 1 | -1) => {
    const shelf = shelfRef.current;
    if (!shelf) return;
    shelf.scrollBy({ left: direction * shelf.clientWidth * SHELF_SCROLL_FRACTION, behavior: "smooth" });
  };
  const shelfArrow =
    "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const madeForYouSection = (
    <HomeSection
      title="Made for you"
      dimmed={isLoadingSuggestions}
      action={
        isLoadingSuggestions ? undefined : (
          <div className="flex items-center gap-0.5">
            <button type="button" className={shelfArrow} onClick={() => scrollShelf(-1)}>
              <SquareAltArrowLeftIcon size={20} aria-hidden="true" />
              <span className="sr-only">Scroll left</span>
            </button>
            <button type="button" className={shelfArrow} onClick={() => scrollShelf(1)}>
              <SquareAltArrowRightIcon size={20} aria-hidden="true" />
              <span className="sr-only">Scroll right</span>
            </button>
          </div>
        )
      }
    >
      {/*
        A plain scrolling shelf: drag-free, wheel- or arrow-scrollable, with the scrollbar hidden
        because the arrows in the heading do that job. Snapping is `proximity` so a slow scroll
        is never fought, but a flick still settles on a card edge.
      */}
      <div
        ref={shelfRef}
        className="-mx-1 flex snap-x snap-proximity gap-1 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:snap-start"
      >
        {isLoadingSuggestions
          ? Array.from({ length: PICKS_SKELETON_COUNT }, (_, index) => (
              <PickCardSkeleton key={index} delayMs={index * 60} />
            ))
          : [
              <DiceCard
                key="dice"
                tracks={surpriseSuggestions}
                isSpinning={isSurpriseSpinning}
                onClick={playSurprise}
              />,
              ...topSuggestions.map((track) => (
                <PickCard
                  key={track.id}
                  artworkUrl={track.artworkUrl}
                  title={track.title}
                  subtitle={track.artist}
                  onContextMenu={(event) => openTrackMenu(event, track)}
                  onSelect={() => playTrack(track, suggestions)}
                />
              )),
            ]}
      </div>
      {isLoadingSuggestions && <span className="sr-only" role="status">Loading suggestions</span>}
    </HomeSection>
  );

  if (!online) {
    return (
      <OfflineHome
        downloads={downloads}
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
        onPlay={(track) => playerController.playTrackById(track.id, downloads)}
        onContextMenu={openTrackMenu}
        onOpenDownloads={destinations.onOpenDownloads}
      />
    );
  }

  if (isPhone) {
    return (
      <PhoneHome
        account={libraryState.library?.account ?? null}
        isSignedOut={libraryState.status === "signed-out"}
        isLoading={isLoadingSuggestions || isWaitingForLibrary}
        recentPlays={recentPlays}
        suggestions={suggestions}
        personalShelves={personalShelves}
        libraryController={libraryController}
        searchController={searchController}
        onPlay={playTrack}
        onTrackMenu={openTrackMenu}
        onOpenAlbum={onOpenAlbum ?? (() => {})}
        onOpenPlaylist={onOpenPlaylist ?? (() => {})}
        onOpenSearch={onOpenSearch ?? (() => {})}
        onOpenDownloads={destinations.onOpenDownloads}
        onSignIn={() => void onSignIn()}
      />
    );
  }

  const isSignedOut = libraryState.status === "signed-out";
  const recentPanel =
    "rounded-3xl bg-white/[0.06] p-2 ring-1 ring-inset ring-white/10";

  return (
    <div className="flex flex-col gap-8 pb-4">
      <HomeHero
        name={accountName}
        isSignedOut={isSignedOut}
        pick={heroPick}
        isLoading={isLoadingSuggestions || isWaitingForLibrary}
        isSurpriseDisabled={surpriseSuggestions.length === 0 || isSurpriseSpinning}
        isSurpriseSpinning={isSurpriseSpinning}
        onPlayPick={() => heroPick && playTrack(heroPick, suggestions)}
        onSurprise={playSurprise}
        onSignIn={() => void onSignIn()}
      />

      {showMadeForYou && madeForYouSection}

      {compactRecent.length === 0 && isWaitingForLibrary && (
        <HomeSection title="Recently played">
          <div
            className={cn("grid gap-1 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]", recentPanel)}
            role="status"
            aria-label="Loading recently played"
          >
            {Array.from({ length: RECENT_COMPACT_COUNT }, (_, index) => (
              <TrackRowSkeleton key={index} delayMs={index * 60} />
            ))}
          </div>
        </HomeSection>
      )}

      {compactRecent.length > 0 && (
        <HomeSection title="Recently played">
          <div className={cn("grid gap-1 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]", recentPanel)}>
            {compactRecent.map((track) => (
              <button
                key={track.id}
                type="button"
                className="group/row flex w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onContextMenu={(event) => openTrackMenu(event, track)}
                onClick={() => playTrack(track, recentPlays)}
              >
                <TrackArtwork
                  className="size-11 shrink-0 rounded-lg object-cover"
                  size={44}
                  artworkUrl={track.artworkUrl}
                  iconSize={24}
                />
                <span className="flex min-w-0 flex-1 flex-col [&_span]:truncate [&_span]:text-xs [&_span]:text-muted-foreground [&_strong]:truncate [&_strong]:text-sm [&_strong]:font-medium">
                  <strong>{track.title}</strong>
                  <ArtistLinks artists={track.artists} fallback={track.artist} />
                </span>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-visible/row:opacity-100">
                  <PlayActiveIcon size={16} />
                </span>
              </button>
            ))}
          </div>
        </HomeSection>
      )}

      {moreSuggestions.length === 0 && isLoadingSuggestions && (
        <HomeSection title="More recommendations">
          <AlbumGridSkeleton count={MORE_SUGGESTIONS_COUNT} label="Loading more recommendations" />
        </HomeSection>
      )}

      {moreSuggestions.length > 0 && (
        <HomeSection title="More recommendations">
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))]">
            {moreSuggestions.map((track) => (
              <AlbumCard
                key={track.id}
                artworkUrl={track.artworkUrl}
                title={track.title}
                subtitleContent={<ArtistLinks artists={track.artists} fallback={track.artist} />}
                onContextMenu={(event) => openTrackMenu(event, track)}
                onClick={() => playTrack(track, suggestions)}
              />
            ))}
          </div>
        </HomeSection>
      )}

      {largeRecent.length === 0 && isWaitingForLibrary && (
        <HomeSection title="Listen again">
          <AlbumGridSkeleton count={RECENT_LARGE_COUNT} label="Loading listen again" />
        </HomeSection>
      )}

      {largeRecent.length > 0 && (
        <HomeSection title="Listen again">
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))]">
            {largeRecent.map((track) => (
              <AlbumCard
                key={track.id}
                artworkUrl={track.artworkUrl}
                title={track.title}
                subtitleContent={<ArtistLinks artists={track.artists} fallback={track.artist} />}
                onContextMenu={(event) => openTrackMenu(event, track)}
                onClick={() => playTrack(track, recentPlays)}
              />
            ))}
          </div>
        </HomeSection>
      )}

      {!isLoadingSuggestions && suggestions.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-white/[0.06] px-4 py-10 text-center text-sm text-muted-foreground ring-1 ring-inset ring-white/10">
          <p>Recommendations could not be loaded.</p>
          {isSignedOut && (
            <button
              type="button"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => void onSignIn()}
            >
              Sign in with YouTube Music
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const OFFLINE_HOME_LIMIT = 50;

/**
 * Home with no connection: the downloads, since they are the only thing that can play.
 *
 * The online feed is recommendations and history, which offline is a wall of songs that fail.
 */
function OfflineHome({
  downloads,
  currentTrackId,
  isPlaying,
  onPlay,
  onContextMenu,
  onOpenDownloads,
}: {
  downloads: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlay: (track: Track) => void;
  onContextMenu: (event: MouseEvent<HTMLElement>, track: Track) => void;
  onOpenDownloads: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1" role="status">
        <h1 className="font-display text-5xl font-semibold leading-[1.12] tracking-[0.005em] text-foreground">You&apos;re offline</h1>
        <p className="text-sm text-muted-foreground">
          {downloads.length > 0
            ? "Your downloaded songs play without a connection."
            : "Nothing is downloaded yet. Songs you download play here when you're offline."}
        </p>
      </header>

      {downloads.length > 0 && (
        <HomeSection
          title="Downloads"
          action={
            downloads.length > OFFLINE_HOME_LIMIT ? (
              <button
                type="button"
                className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={onOpenDownloads}
              >
                See all {downloads.length}
              </button>
            ) : undefined
          }
        >
          <div className="flex flex-col gap-0.5">
            {downloads.slice(0, OFFLINE_HOME_LIMIT).map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                isCurrent={currentTrackId === track.id}
                isPlaying={isPlaying && currentTrackId === track.id}
                onSelect={() => onPlay(track)}
                onContextMenu={(event) => onContextMenu(event, track)}
              />
            ))}
          </div>
        </HomeSection>
      )}
    </div>
  );
}
