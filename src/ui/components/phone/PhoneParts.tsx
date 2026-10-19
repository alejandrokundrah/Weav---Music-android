import type { MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Artist, Track } from "../../../datasource/types";
import { TrackArtwork } from "../TrackArtwork";

/**
 * Small pieces shared by the phone pages (Search, Library, Browse, and the phone Home's
 * siblings). They carry the design's vocabulary so each page does not restate it: a #131313
 * canvas, #1b1b1b surfaces, Lexend, light-weight secondary text in #929292, and a "chosen word
 * is bigger and brighter" tab switch instead of filled pills.
 *
 * Everything is presentational. Pages own their data and hand it in.
 */

/** `tracking-normal`: the base h1/h2 rules add negative tracking and a heavy weight. */
export function PhoneHeading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1
      className={cn(
        "text-[26px] font-semibold leading-8 tracking-normal text-white",
        className,
      )}
    >
      {children}
    </h1>
  );
}

/** Same rhythm as the Home shelves: a 24px heading with 27px before its content. */
export function PhoneSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  /** Right-aligned text button, e.g. "See all". */
  action?: { label: string; onPress: () => void };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("relative mt-10 flex flex-col gap-5", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-medium leading-none tracking-normal text-[#e7e7e7]">{title}</h2>
        {action ? (
          <button
            type="button"
            onClick={action.onPress}
            className="text-sm font-extralight text-[#929292] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {action.label}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export interface PhoneTab<T extends string> {
  value: T;
  label: string;
}

/**
 * The Home switch, made scrollable: the chosen word is larger and brighter with a soft glow,
 * the rest are light grey. A row of five or six labels does not fit a phone's width at the
 * Home's fixed three-column spacing, so these sit left to right and scroll sideways.
 */
export function PhoneTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
}: {
  tabs: ReadonlyArray<PhoneTab<T>>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "-mx-5 flex items-baseline gap-6 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            className={cn(
              "shrink-0 whitespace-nowrap py-1 transition-[color,font-size] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
              selected
                ? "text-xl font-semibold text-[#e7e7e7] [text-shadow:0_10px_30px_rgba(255,255,255,0.3)]"
                : "text-base font-extralight text-[#929292]",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function PhoneMoreGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5.5" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="18.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

/** Row used for every song list on the phone: cover, title and artist, then a "more" button. */
export function PhoneSongRow({
  track,
  isCurrent = false,
  onSelect,
  onMenu,
  trailing,
  dimmed = false,
}: {
  track: Track;
  isCurrent?: boolean;
  onSelect: () => void;
  onMenu?: (event: MouseEvent<HTMLElement>) => void;
  /** Replaces the "more" button, e.g. a download size or progress. */
  trailing?: ReactNode;
  dimmed?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl py-1.5 pl-1.5 pr-1 transition-colors",
        isCurrent && "bg-[#1b1b1b]",
        dimmed && "opacity-60",
      )}
      onContextMenu={onMenu}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Play ${track.title}`}
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <TrackArtwork
          className="size-14 shrink-0 rounded-2xl bg-[#1b1b1b]"
          size={56}
          iconSize={22}
          artworkUrl={track.artworkUrl}
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span
            className={cn(
              "truncate text-sm leading-[18px] text-white",
              isCurrent ? "font-medium" : "font-normal",
            )}
          >
            {track.title}
          </span>
          <span className="truncate text-xs font-extralight leading-[18px] text-[#929292]">
            {track.artist}
          </span>
        </span>
      </button>
      {trailing ??
        (onMenu ? (
          <button
            type="button"
            onClick={onMenu}
            aria-label={`More options for ${track.title}`}
            className="grid size-10 shrink-0 place-items-center rounded-full text-[#929292] transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <PhoneMoreGlyph />
          </button>
        ) : null)}
    </div>
  );
}

/** A round portrait with the name under it; used in artist rows. */
export function PhoneArtistBubble({
  artist,
  onOpen,
  caption,
  className,
}: {
  artist: Artist;
  onOpen: () => void;
  caption?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-[6.5rem] shrink-0 flex-col items-center gap-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
        className,
      )}
    >
      <TrackArtwork
        className="size-24 rounded-full bg-[#1b1b1b]"
        size={96}
        artworkUrl={artist.artworkUrl}
        iconSize={28}
        variant="artist"
      />
      <span className="line-clamp-2 text-sm font-normal leading-[18px] text-white">{artist.name}</span>
      {caption ? (
        <span className="-mt-1 truncate text-xs font-extralight text-[#929292]">{caption}</span>
      ) : null}
    </button>
  );
}

/** A horizontal scroller that bleeds to the screen edges, for rows of bubbles and chips. */
export function PhoneScroller({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "-mx-5 flex gap-4 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PhoneNotice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("mt-16 text-center text-sm font-light text-[#929292]", className)}>{children}</p>
  );
}

/** A quiet pill button, e.g. "Clear filter" or "Show hidden". */
export function PhonePill({
  children,
  onPress,
  active = false,
  className,
}: {
  children: ReactNode;
  onPress: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        "rounded-full px-5 py-2.5 text-sm font-light transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
        active ? "bg-white text-[#131313]" : "bg-[#1b1b1b] text-[#cdcdcd]",
        className,
      )}
    >
      {children}
    </button>
  );
}
