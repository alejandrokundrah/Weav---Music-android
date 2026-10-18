import { useState, type MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { HeartIcon, PlayActiveIcon, SearchIcon } from "@/ui/icons";
import type { AccountProfile, Track } from "../../datasource/types";
import { ArtistLinks } from "../components/ArtistLinks";
import { TrackArtwork } from "../components/TrackArtwork";

type HomeFilter = "all" | "recent" | "foryou";

const FILTERS: ReadonlyArray<{ value: HomeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "recent", label: "Recently played" },
  { value: "foryou", label: "For you" },
];

interface PhoneHomeProps {
  account: AccountProfile | null;
  isSignedOut: boolean;
  isLoading: boolean;
  recentPlays: readonly Track[];
  suggestions: readonly Track[];
  currentTrackId: string | null;
  onPlay: (track: Track, queue: readonly Track[]) => void;
  onTrackMenu: (event: MouseEvent<HTMLElement>, track: Track) => void;
  onOpenSearch: () => void;
  onOpenLibrary: () => void;
  onOpenHistory: () => void;
  onSignIn: () => void;
}

/**
 * The phone's Home: a greeting, filter chips, one featured card and plain song rows.
 *
 * It reads the same lists the desktop Home builds (recent plays and recommendations) and
 * plays through the same callback; only the presentation differs.
 */
export function PhoneHome({
  account,
  isSignedOut,
  isLoading,
  recentPlays,
  suggestions,
  currentTrackId,
  onPlay,
  onTrackMenu,
  onOpenSearch,
  onOpenLibrary,
  onOpenHistory,
  onSignIn,
}: PhoneHomeProps) {
  const [filter, setFilter] = useState<HomeFilter>("all");

  const firstName = account?.name?.trim().split(/\s+/)[0];
  const featured = suggestions[0];
  const showRecent = filter !== "foryou";
  const showForYou = filter !== "recent";
  const recent = recentPlays.slice(0, filter === "recent" ? 30 : 6);
  const forYou = suggestions.slice(1, filter === "foryou" ? 40 : 9);

  return (
    <div className="flex flex-col gap-6 pb-4">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="size-12 shrink-0 overflow-hidden rounded-full bg-card">
            {account?.artworkUrl ? (
              <img src={account.artworkUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center text-lg font-semibold text-primary">
                {(firstName ?? "Z").slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Search"
              className="flex size-11 items-center justify-center rounded-full bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <SearchIcon size={20} />
            </button>
            <button
              type="button"
              onClick={onOpenLibrary}
              aria-label="Your library"
              className="flex size-11 items-center justify-center rounded-full bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <HeartIcon size={20} />
            </button>
          </div>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {firstName ? `Hi, ${firstName}` : "Welcome"}
        </h1>
      </header>

      {isSignedOut && (
        <section className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground">
          <p>Sign in to see your history, playlists and albums.</p>
          <button
            type="button"
            onClick={onSignIn}
            className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Sign in
          </button>
        </section>
      )}

      <div
        role="tablist"
        aria-label="Filter home"
        className="-mx-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              "shrink-0 rounded-full px-5 py-2.5 text-sm font-medium transition-colors",
              filter === value
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {filter === "all" && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-foreground">Curated &amp; trending</h2>
          <div className="relative flex min-h-40 items-stretch overflow-hidden rounded-3xl bg-[#c4a8f5] p-5 text-[#1b1230]">
            <div className="z-10 flex max-w-[60%] flex-col justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-bold">Made for you</h3>
                <p className="text-xs leading-snug opacity-80">
                  A fresh mix picked from what you have been listening to.
                </p>
              </div>
              <button
                type="button"
                disabled={!featured}
                onClick={() => featured && onPlay(featured, suggestions)}
                aria-label="Play your mix"
                className="flex size-12 items-center justify-center rounded-full bg-[#2a1850] text-white transition-transform active:scale-95 disabled:opacity-40"
              >
                <PlayActiveIcon size={22} />
              </button>
            </div>
            {featured?.artworkUrl && (
              <img
                src={featured.artworkUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-y-0 right-0 h-full w-2/5 object-cover [mask-image:linear-gradient(to_right,transparent,black_40%)]"
              />
            )}
          </div>
        </section>
      )}

      {isLoading && recent.length === 0 && forYou.length === 0 && (
        <div className="flex flex-col gap-3" role="status" aria-label="Loading">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="size-14 animate-pulse rounded-2xl bg-card" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-3 w-2/3 animate-pulse rounded bg-card" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-card" />
              </div>
            </div>
          ))}
        </div>
      )}

      {showRecent && recent.length > 0 && (
        <TrackSection
          title="Recently played"
          actionLabel={filter === "all" ? "See all" : undefined}
          onAction={onOpenHistory}
          tracks={recent}
          queue={recentPlays}
          currentTrackId={currentTrackId}
          onPlay={onPlay}
          onTrackMenu={onTrackMenu}
        />
      )}

      {showForYou && forYou.length > 0 && (
        <TrackSection
          title="Top picks for you"
          tracks={forYou}
          queue={suggestions}
          currentTrackId={currentTrackId}
          onPlay={onPlay}
          onTrackMenu={onTrackMenu}
        />
      )}
    </div>
  );
}

interface TrackSectionProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  tracks: readonly Track[];
  queue: readonly Track[];
  currentTrackId: string | null;
  onPlay: (track: Track, queue: readonly Track[]) => void;
  onTrackMenu: (event: MouseEvent<HTMLElement>, track: Track) => void;
}

function TrackSection({
  title,
  actionLabel,
  onAction,
  tracks,
  queue,
  currentTrackId,
  onPlay,
  onTrackMenu,
}: TrackSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        {actionLabel && onAction && (
          <button type="button" onClick={onAction} className="text-sm text-muted-foreground">
            {actionLabel}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {tracks.map((track) => (
          <PhoneTrackRow
            key={track.id}
            track={track}
            isCurrent={track.id === currentTrackId}
            onPlay={() => onPlay(track, queue)}
            onMenu={(event) => onTrackMenu(event, track)}
          />
        ))}
      </div>
    </section>
  );
}

/** Rounded cover, title and artist, and a round play button — the row from the reference. */
export function PhoneTrackRow({
  track,
  isCurrent,
  onPlay,
  onMenu,
}: {
  track: Track;
  isCurrent: boolean;
  onPlay: () => void;
  onMenu?: (event: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <div
      className="flex items-center gap-3"
      onContextMenu={onMenu}
    >
      <button
        type="button"
        onClick={onPlay}
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <TrackArtwork
          className="size-14 shrink-0 rounded-2xl object-cover"
          size={112}
          artworkUrl={track.artworkUrl}
          iconSize={24}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <strong
            className={cn(
              "truncate text-sm font-semibold",
              isCurrent ? "text-primary" : "text-foreground",
            )}
          >
            {track.title}
          </strong>
          <span className="truncate text-xs text-muted-foreground">
            <ArtistLinks artists={track.artists} fallback={track.artist} />
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onPlay}
        aria-label={`Play ${track.title}`}
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-foreground transition-transform active:scale-95"
      >
        <PlayActiveIcon size={16} />
      </button>
    </div>
  );
}
