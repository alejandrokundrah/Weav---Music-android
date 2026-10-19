import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { cn } from "@/lib/utils";
import type {
  AccountProfile,
  Album,
  BrowsePage,
  BrowseShelf,
  Playlist,
  SearchResults,
  Track,
} from "../../datasource/types";
import { logInternalError } from "../../internal/logging";
import type { LibraryController } from "../../player/LibraryController";
import type { SearchController } from "../../player/SearchController";
import {
  CoverCard,
  CoverCardSkeleton,
  FocusCarousel,
  ShelfRow,
} from "../components/phone/CoverCard";
import { PhoneHomeHeader } from "../components/phone/PhoneHomeHeader";

type HomeTab = "podcasts" | "music" | "asmr";

const TABS: ReadonlyArray<{ value: HomeTab; label: string }> = [
  { value: "podcasts", label: "Podcasts" },
  { value: "music", label: "Music" },
  { value: "asmr", label: "ASMR" },
];

/** How many cards each row is allowed to build; a feed can hold far more than anyone scrolls. */
const HERO_LIMIT = 10;
const SHELF_LIMIT = 12;

/**
 * Which Explore shelf is "New Releases". YouTube titles it "New albums & singles" today and
 * has changed the wording before, so this matches the idea rather than the string.
 */
const NEW_RELEASES_TITLE = /\bnew (albums?|releases?|music)\b/i;

interface PhoneHomeProps {
  account: AccountProfile | null;
  isSignedOut: boolean;
  isLoading: boolean;
  recentPlays: readonly Track[];
  suggestions: readonly Track[];
  libraryController: LibraryController;
  searchController: SearchController;
  onPlay: (track: Track, queue: readonly Track[]) => void;
  onTrackMenu: (event: MouseEvent<HTMLElement>, track: Track) => void;
  onOpenAlbum: (album: Album) => void;
  onOpenPlaylist: (playlist: Playlist) => void;
  onOpenSearch: () => void;
  /** The header's downloads panel links through to the full Downloads page. */
  onOpenDownloads: () => void;
  onSignIn: () => void;
}

/** One card in a row, already bound to what tapping it and its play button do. */
interface FeedCard {
  id: string;
  title: string;
  subtitle?: string;
  artworkUrl?: string;
  variant: "track" | "album" | "playlist";
  open: () => void;
  play?: () => void;
  menu?: (event: MouseEvent<HTMLElement>) => void;
}

interface FeedShelf {
  title: string;
  cards: FeedCard[];
}

type Remote<T> =
  | { status: "idle" | "loading" | "error" }
  | { status: "ready"; data: T };

/**
 * Loads once, the first time `enabled` turns true, and keeps the result for as long as Home
 * stays mounted. The data source caches browse pages itself, so there is nothing to refresh
 * here; this only stops flipping between tabs from refetching.
 */
function useRemote<T>(enabled: boolean, load: () => Promise<T>, label: string): Remote<T> {
  const [state, setState] = useState<Remote<T>>({ status: "idle" });
  const startedRef = useRef(false);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;
    setState({ status: "loading" });
    loadRef.current()
      .then((data) => setState({ status: "ready", data }))
      .catch((error: unknown) => {
        logInternalError(`PhoneHome ${label} failed to load`, error);
        setState({ status: "error" });
      });
  }, [enabled, label]);

  return state;
}

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return "Good Evening";
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function hasContent(shelf: BrowseShelf): boolean {
  return shelf.albums.length + shelf.playlists.length + shelf.tracks.length > 0;
}

/**
 * The phone's Home: greeting, a Podcasts / Music / ASMR switch, a centred carousel of covers
 * and shelves of them underneath.
 *
 * Music is built from what the desktop Home already computes — recommendations for the
 * carousel, recent plays as a shelf — plus YouTube Music's Explore feed for New Releases.
 * Podcasts and ASMR are fetched the first time their tab is opened.
 */
export function PhoneHome({
  account,
  isSignedOut,
  isLoading,
  recentPlays,
  suggestions,
  libraryController,
  searchController,
  onPlay,
  onTrackMenu,
  onOpenAlbum,
  onOpenPlaylist,
  onOpenSearch,
  onOpenDownloads,
  onSignIn,
}: PhoneHomeProps) {
  const [tab, setTab] = useState<HomeTab>("music");
  const [visited, setVisited] = useState<ReadonlySet<HomeTab>>(() => new Set(["music"]));

  const selectTab = (next: HomeTab) => {
    setTab(next);
    setVisited((current) => (current.has(next) ? current : new Set(current).add(next)));
  };

  const explore = useRemote<BrowsePage>(
    visited.has("music"),
    () => libraryController.getBrowsePage("explore"),
    "explore",
  );
  const podcasts = useRemote<BrowsePage>(
    visited.has("podcasts"),
    () => libraryController.getBrowsePage("podcasts"),
    "podcasts",
  );
  const asmr = useRemote<SearchResults>(
    visited.has("asmr"),
    () => searchController.search("ASMR"),
    "asmr",
  );

  const playLoaded = useCallback(
    (load: () => Promise<Track[]>) => {
      void load()
        .then((tracks) => {
          if (tracks[0]) onPlay(tracks[0], tracks);
        })
        .catch((error: unknown) => logInternalError("PhoneHome could not start playback", error));
    },
    [onPlay],
  );

  const cards = useMemo(() => {
    const track = (item: Track, queue: readonly Track[]): FeedCard => ({
      id: `track:${item.id}`,
      title: item.title,
      subtitle: item.artist,
      artworkUrl: item.artworkUrl,
      variant: "track",
      open: () => onPlay(item, queue),
      play: () => onPlay(item, queue),
      menu: (event) => onTrackMenu(event, item),
    });
    const album = (item: Album): FeedCard => ({
      id: `album:${item.id}`,
      title: item.title,
      subtitle: item.artist,
      artworkUrl: item.artworkUrl,
      variant: "album",
      open: () => onOpenAlbum(item),
      play: () => playLoaded(() => libraryController.getAlbumTracks(item)),
    });
    const playlist = (item: Playlist): FeedCard => ({
      id: `playlist:${item.id}`,
      title: item.title,
      subtitle: item.owner,
      artworkUrl: item.artworkUrl,
      variant: "playlist",
      open: () => onOpenPlaylist(item),
      play: () => playLoaded(() => libraryController.getPlaylistTracks(item)),
    });
    /** A browse shelf mixes albums, playlists and songs; show them in that order. */
    const fromShelf = (shelf: BrowseShelf): FeedCard[] => [
      ...shelf.playlists.map(playlist),
      ...shelf.albums.map(album),
      ...shelf.tracks.map((item) => track(item, shelf.tracks)),
    ];
    return { track, album, playlist, fromShelf };
  }, [libraryController, onOpenAlbum, onOpenPlaylist, onPlay, onTrackMenu, playLoaded]);

  const firstName = account?.name?.trim().split(/\s+/)[0];
  const [now] = useState(() => new Date());

  /* ── What the current tab shows ── */
  let hero: FeedCard[] = [];
  let heroLoading = false;
  let shelves: FeedShelf[] = [];
  let shelfLoading: string | null = null;
  let failed = false;

  if (tab === "music") {
    hero = suggestions.slice(0, HERO_LIMIT).map((item) => cards.track(item, suggestions));
    heroLoading = hero.length === 0 && isLoading;

    if (explore.status === "ready") {
      const shelf = explore.data.shelves.find(
        (candidate) => NEW_RELEASES_TITLE.test(candidate.title) && hasContent(candidate),
      );
      if (shelf) {
        shelves.push({ title: "New Releases", cards: cards.fromShelf(shelf).slice(0, SHELF_LIMIT) });
      }
    } else if (explore.status !== "error") {
      shelfLoading = "New Releases";
    }

    if (recentPlays.length > 0) {
      shelves.push({
        title: "Recently played",
        cards: recentPlays.slice(0, SHELF_LIMIT).map((item) => cards.track(item, recentPlays)),
      });
    }
  } else if (tab === "podcasts") {
    if (podcasts.status === "ready") {
      const [lead, ...rest] = podcasts.data.shelves.filter(hasContent);
      hero = lead ? cards.fromShelf(lead).slice(0, HERO_LIMIT) : [];
      shelves = rest
        .slice(0, 3)
        .map((shelf) => ({ title: shelf.title, cards: cards.fromShelf(shelf).slice(0, SHELF_LIMIT) }));
    } else if (podcasts.status === "error") {
      failed = true;
    } else {
      heroLoading = true;
    }
  } else {
    if (asmr.status === "ready") {
      const { tracks, playlists } = asmr.data;
      hero = tracks.length > 0
        ? tracks.slice(0, HERO_LIMIT).map((item) => cards.track(item, tracks))
        : playlists.slice(0, HERO_LIMIT).map(cards.playlist);
      if (tracks.length > 0 && playlists.length > 0) {
        shelves = [{ title: "Playlists", cards: playlists.slice(0, SHELF_LIMIT).map(cards.playlist) }];
      }
    } else if (asmr.status === "error") {
      failed = true;
    } else {
      heroLoading = true;
    }
  }

  const isEmpty = !heroLoading && hero.length === 0 && shelves.length === 0 && !shelfLoading;

  return (
    <div
      className="font-lexend flex flex-col px-5 pb-4 pt-3 text-white"
      style={{ "--card-w": "min(51vw, 15rem)" } as CSSProperties}
    >
      {/* The page runs edge to edge (Layout's `edgeToEdge`), so the header's gutters are the
          design's own 20px; the carousels below pull back out of them with `-mx-5`. */}
      <PhoneHomeHeader
        greeting={greetingFor(now)}
        name={firstName ?? "Welcome"}
        avatarUrl={account?.artworkUrl}
        onOpenSearch={onOpenSearch}
        onOpenDownloads={onOpenDownloads}
      />

      <div
        role="tablist"
        aria-label="Home sections"
        className="mt-6 grid grid-cols-3 items-center pl-0 pr-1"
      >
        {TABS.map(({ value, label }, index) => {
          const selected = tab === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => selectTab(value)}
              className={cn(
                "py-1 transition-[color,font-size] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                index === 0 && "justify-self-start",
                index === 1 && "justify-self-center",
                index === 2 && "justify-self-end",
                selected
                  ? "text-2xl font-semibold text-[#e7e7e7] [text-shadow:0_10px_30px_rgba(255,255,255,0.3)]"
                  : "text-base font-extralight text-[#929292]",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {isSignedOut && (
        <section className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-[#1b1b1b] px-4 py-3 text-sm font-light text-[#929292]">
          <p>Sign in to see your history, playlists and albums.</p>
          <button
            type="button"
            onClick={onSignIn}
            className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#131313]"
          >
            Sign in
          </button>
        </section>
      )}

      {/* Keyed by tab so each one opens centred on its first card. */}
      {heroLoading ? (
        <div className="mt-9">
          <FocusCarousel key={`${tab}:loading`} label="Loading">
            {[0, 1, 2].map((slot) => (
              <CoverCardSkeleton key={slot} layout="hero" />
            ))}
          </FocusCarousel>
        </div>
      ) : hero.length > 0 ? (
        <div className="relative mt-9">
          <FocusCarousel key={tab} label={TABS.find((item) => item.value === tab)?.label ?? "Featured"}>
            {hero.map((card) => (
              <CoverCard
                key={card.id}
                layout="hero"
                title={card.title}
                subtitle={card.subtitle}
                artworkUrl={card.artworkUrl}
                variant={card.variant}
                onOpen={card.open}
                onPlay={card.play}
                onContextMenu={card.menu}
              />
            ))}
          </FocusCarousel>
        </div>
      ) : null}

      {shelves.map((shelf) => (
        <ShelfSection key={`${tab}:${shelf.title}`} title={shelf.title}>
          <ShelfRow label={shelf.title}>
            {shelf.cards.map((card) => (
              <CoverCard
                key={card.id}
                layout="shelf"
                title={card.title}
                subtitle={card.subtitle}
                artworkUrl={card.artworkUrl}
                variant={card.variant}
                onOpen={card.open}
                onPlay={card.play}
                onContextMenu={card.menu}
              />
            ))}
          </ShelfRow>
        </ShelfSection>
      ))}

      {shelfLoading && (
        <ShelfSection title={shelfLoading}>
          <ShelfRow label="Loading">
            {[0, 1].map((slot) => (
              <CoverCardSkeleton key={slot} layout="shelf" />
            ))}
          </ShelfRow>
        </ShelfSection>
      )}

      {(isEmpty || failed) && (
        <p className="mt-16 text-center text-sm font-light text-[#929292]">
          {failed ? "Couldn't load this right now. Try again in a moment." : "Nothing here yet."}
        </p>
      )}
    </div>
  );
}

/**
 * A titled row. `relative` is deliberate: the carousels above it are positioned and padded
 * to keep their shadows from being clipped, and a positioned sibling is what keeps those
 * invisible padding areas from sitting on top of this section's taps.
 */
function ShelfSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="relative mt-[50px] flex flex-col gap-[27px]">
      <h2 className="text-2xl font-medium leading-none tracking-normal text-[#e7e7e7]">{title}</h2>
      {children}
    </section>
  );
}
