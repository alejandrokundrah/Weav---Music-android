import type { Track } from "../../datasource/types";
import { cn } from "@/lib/utils";
import { PlayActiveIcon, ShuffleActiveIcon } from "@/ui/icons";
import { ArtistLinks } from "./ArtistLinks";
import { HERO_PILL } from "./MediaHeader";
import { TrackArtwork } from "./TrackArtwork";

/** "Good morning" and friends, from the local hour. */
function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  if (hour >= 18 && hour < 23) return "Good evening";
  return "Good night";
}

interface HomeHeroProps {
  /** First name or channel name; absent when signed out. */
  name?: string;
  isSignedOut: boolean;
  /** The song the banner is built around — the top recommendation. */
  pick?: Track;
  isLoading: boolean;
  isSurpriseDisabled: boolean;
  isSurpriseSpinning: boolean;
  onPlayPick: () => void;
  onSurprise: () => void;
  onSignIn: () => void;
  /** Opens the swipe-to-discover feed; hidden when the build has none. */
}

/**
 * The banner at the head of Home — the same hero the artist, album and playlist pages open with.
 *
 * It is built around one real recommendation: that song's cover, blown up and blurred, tints the
 * whole banner, and the sharp cover sits on the right. A greeting would otherwise be a heading
 * over an empty strip; this way the first thing on the page is something to play. The actions
 * are the three ways in — play it, let the app choose, or sign in.
 */
export function HomeHero({
  name,
  isSignedOut,
  pick,
  isLoading,
  isSurpriseDisabled,
  isSurpriseSpinning,
  onPlayPick,
  onSurprise,
  onSignIn,
}: HomeHeroProps) {
  const greeting = isSignedOut ? "Welcome to WEAV" : `${greetingFor(new Date())}${name ? `, ${name}` : ""}`;

  return (
    <header className="relative isolate overflow-hidden rounded-3xl bg-black/20">
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        {pick?.artworkUrl ? (
          <div className="absolute inset-0 scale-125 opacity-80 blur-3xl saturate-150">
            <TrackArtwork
              className="size-full"
              artworkUrl={pick.artworkUrl}
              size={120}
              iconSize={0}
              loading="eager"
              variant="album"
            />
          </div>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/5" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/10 to-transparent" />
      </div>

      <div className="relative flex min-h-[15.5rem] flex-wrap items-end gap-x-6 gap-y-4 p-6 pt-24">
        <div className="flex min-w-0 flex-1 basis-80 flex-col gap-2">
          <span className="flex items-center gap-2 font-lexend text-sm font-light text-white/90">
            <span className="size-2 rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]" aria-hidden="true" />
            {isSignedOut ? "Sign in for your own picks" : "Picked for you"}
          </span>
          <h1 className="line-clamp-2 font-display text-5xl font-semibold leading-[1.12] tracking-[0.005em] text-white">
            {greeting}
          </h1>
          {pick ? (
            <p className="flex min-w-0 items-center gap-1.5 truncate text-sm text-white/80">
              <span className="truncate font-medium text-white">{pick.title}</span>
              <span aria-hidden="true">·</span>
              <ArtistLinks className="truncate" artists={pick.artists} fallback={pick.artist} />
            </p>
          ) : isLoading ? (
            <span className="h-4 w-56 animate-pulse rounded-md bg-white/15" aria-hidden="true" />
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!pick}
              onClick={onPlayPick}
              aria-label={pick ? `Play ${pick.title}` : "Play"}
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground",
                "shadow-lg shadow-black/30 transition-transform hover:scale-[1.05] active:scale-95",
                "disabled:pointer-events-none disabled:opacity-50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40",
              )}
            >
              <PlayActiveIcon size={22} aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={isSurpriseDisabled}
              onClick={onSurprise}
              className={HERO_PILL}
            >
              <ShuffleActiveIcon
                size={18}
                aria-hidden="true"
                className={cn(isSurpriseSpinning && "motion-safe:animate-spin")}
              />
              Surprise me
            </button>
            {isSignedOut ? (
              <button
                type="button"
                onClick={onSignIn}
                className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/30 transition-transform hover:scale-[1.03] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Sign in
              </button>
            ) : null}
          </div>
        </div>

        {pick?.artworkUrl ? (
          <TrackArtwork
            className="hidden size-40 shrink-0 rounded-2xl shadow-2xl shadow-black/40 ring-1 ring-white/15 sm:block"
            artworkUrl={pick.artworkUrl}
            iconSize={56}
            loading="eager"
            size={160}
            variant="album"
          />
        ) : null}
      </div>
    </header>
  );
}
