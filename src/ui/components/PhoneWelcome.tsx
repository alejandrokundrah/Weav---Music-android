import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { GoogleIcon } from "@/ui/icons";
import { SpinnerSteps } from "@/components/motion/loader";
import { libraryController } from "../../player/playerStore";
import type { BrowsePage, GoogleAccountOption } from "../../datasource/types";
import { artworkIdentity } from "../../datasource/youtube/artwork";
import { useReduceMotion } from "../settings/renderEffects";
import { TrackArtwork } from "./TrackArtwork";
import appIcon from "../../../assets/img/logo.svg";

/*
 * The first screen on a phone: a sign-in welcome that replaces the desktop spotlight tour.
 *
 * The tour points at a search bar and a tab strip, neither of which exists in the phone layout,
 * so on a phone it could only ever show a card pointing at nothing. This screen does the one
 * job a first launch has there — offer to connect an account — and lets anyone leave without.
 *
 * Geometry is in `vw` on purpose. The artwork columns are a composition (a tall centre column
 * flanked by two cropped ones), not a flow layout, so they are placed against the screen's width
 * and the tall screen simply shows more or less of the dark below them.
 */

interface Tile {
  /** Stacked CSS backgrounds, brightest layer first. */
  background: string;
  /** Concentric rings, to read as a record sleeve rather than a flat swatch. */
  rings?: boolean;
}

/*
 * Placeholder artwork. Each tile is painted with one of these first and keeps it if no real
 * image arrives (offline first launch, or a browse page that came back empty), so the screen is
 * never blank. Real artist portraits and covers are laid over them by `useWelcomeArtwork`.
 */
const TILES: Record<string, Tile> = {
  green: {
    background:
      "radial-gradient(120% 70% at 50% 0%, #7fa77a 0%, #6a9468 45%, #5b8259 100%)",
  },
  sun: {
    background:
      "radial-gradient(70% 45% at 50% 38%, #d8c227 0%, #b8a21e 38%, transparent 70%), linear-gradient(180deg, #8f7a12 0%, #6b3f22 62%, #4a2515 100%)",
    rings: true,
  },
  blue: {
    background:
      "radial-gradient(90% 55% at 30% 25%, #5e8fb8 0%, #2f5d86 50%, transparent 85%), linear-gradient(180deg, #274d73 0%, #14304d 100%)",
  },
  cream: {
    background:
      "radial-gradient(80% 50% at 60% 35%, #e8d9cb 0%, #b79f8e 55%, transparent 90%), linear-gradient(180deg, #a58f82 0%, #6e5b52 100%)",
  },
  navy: {
    background: "linear-gradient(180deg, #0f1f4d 0%, #0a1332 100%)",
    rings: true,
  },
  violet: {
    background:
      "radial-gradient(90% 55% at 50% 30%, #8a86c4 0%, #6a65a3 55%, #5a5592 100%)",
  },
};

/** Tiles are filled in this order, so the most visible one (the full centre tile) gets the first image. */
const TILE_ORDER = ["sun", "green", "blue", "cream", "violet", "navy"] as const;

/** Tiles are 51vw wide; the artwork is requested at that size so a phone does not decode originals. */
function tileWidthPx(): number {
  return typeof window === "undefined" ? 210 : Math.round(window.innerWidth * 0.51);
}

/**
 * Artwork for a tile, one image per distinct picture: artist portraits first (they are the point
 * of the screen), then album covers, playlists and finally track thumbnails to make up the count.
 */
function collectWelcomeArtwork(pages: BrowsePage[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  const add = (url: string | undefined) => {
    const trimmed = url?.trim();
    if (!trimmed) return;
    const identity = artworkIdentity(trimmed);
    if (seen.has(identity)) return;
    seen.add(identity);
    urls.push(trimmed);
  };

  const shelves = pages.flatMap((page) => page.shelves);
  for (const shelf of shelves) for (const artist of shelf.artists) add(artist.artworkUrl);
  for (const shelf of shelves) for (const album of shelf.albums) add(album.artworkUrl);
  for (const shelf of shelves) for (const playlist of shelf.playlists) add(playlist.artworkUrl);
  for (const shelf of shelves) for (const track of shelf.tracks) add(track.artworkUrl);
  return urls;
}

/**
 * Real artwork for the backdrop, taken from the charts (then Explore) — both work signed out.
 *
 * Best effort and silent, like the stored-account lookup: the gradients are already on screen,
 * so a slow or failed request just means they stay. Explore is only asked for when the charts
 * did not supply enough images by themselves.
 */
function useWelcomeArtwork(): string[] {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const pages: BrowsePage[] = [];
      for (const surface of ["charts", "explore"] as const) {
        try {
          pages.push(await libraryController.getBrowsePage(surface));
        } catch {
          /* Try the next surface; the gradients cover whatever is still missing. */
        }
        if (collectWelcomeArtwork(pages).length >= TILE_ORDER.length) break;
      }
      if (active) setUrls(collectWelcomeArtwork(pages).slice(0, TILE_ORDER.length));
    })();
    return () => {
      active = false;
    };
  }, []);

  return urls;
}

function ArtTile({
  tile,
  artworkUrl,
  className,
  style,
}: {
  tile: Tile;
  artworkUrl?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("absolute overflow-hidden rounded-[2.6vw]", className)}
      style={{ ...style, background: tile.background }}
    >
      {artworkUrl && (
        /* `text-transparent` hides the component's own placeholder note while the image loads;
           the tile's gradient is the placeholder here. */
        <TrackArtwork
          className="absolute inset-0 size-full text-transparent"
          artworkUrl={artworkUrl}
          size={tileWidthPx()}
          loading="eager"
          preferProxy
          retryOnError
        />
      )}
      {/* Rings suit the flat gradient; over a real photograph they would just be noise. */}
      {tile.rings && !artworkUrl && (
        <div
          className="absolute left-1/2 top-[44%] aspect-square w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "repeating-radial-gradient(circle, rgb(255 255 255 / 0.10) 0 1px, transparent 1px 7px)",
            boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.12)",
          }}
        />
      )}
      {/* The whole backdrop is dimmed a notch so the text on top stays the brightest thing. */}
      <div className="absolute inset-0 bg-black/25" />
    </div>
  );
}

/** One column of tiles that drifts a little, so the screen is not a still image. */
function Column({
  children,
  drift,
  duration,
  animated,
}: {
  children: React.ReactNode;
  drift: number;
  duration: number;
  animated: boolean;
}) {
  return (
    <motion.div
      className="absolute inset-0"
      animate={animated ? { y: [0, drift, 0] } : undefined}
      transition={animated ? { duration, ease: "easeInOut", repeat: Infinity } : undefined}
    >
      {children}
    </motion.div>
  );
}

interface PhoneWelcomeProps {
  /** Starts the Google sign-in. The caller decides what happens once it succeeds. */
  onSignIn: () => void;
  /** Leaves without signing in. */
  onSkip: () => void;
  /** A sign-in is already running; blocks a second tap. */
  isBusy?: boolean;
}

export function PhoneWelcome({ onSignIn, onSkip, isBusy = false }: PhoneWelcomeProps) {
  const reduceMotion = useReduceMotion();
  const [account, setAccount] = useState<GoogleAccountOption | null>(null);
  const artwork = useWelcomeArtwork();
  /** The image for a named tile, or nothing to leave its gradient showing. */
  const artFor = (key: (typeof TILE_ORDER)[number]) => artwork[TILE_ORDER.indexOf(key)];

  /*
   * A stored login is offered by name, the way the reference does ("Continue as …"). Best
   * effort and silent: on a first launch there is nothing stored, and the screen is complete
   * without it.
   */
  useEffect(() => {
    let active = true;
    void libraryController
      .listGoogleAccounts()
      .then((accounts) => {
        if (!active) return;
        setAccount(accounts.find((entry) => entry.isActive) ?? accounts[0] ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const animated = !reduceMotion;
  const name = account?.name;

  return (
    <div
      className="font-lexend fixed inset-0 z-[95] overflow-hidden bg-[#08140f] text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="phone-welcome-title"
    >
      {/* Left column — cropped by the screen edge. */}
      <Column drift={-14} duration={14} animated={animated}>
        <ArtTile tile={TILES.blue} artworkUrl={artFor("blue")} className="left-[-33vw] w-[51vw]" style={{ top: "42.5vw", height: "78.5vw" }} />
        <ArtTile tile={TILES.navy} artworkUrl={artFor("navy")} className="left-[-33vw] w-[51vw]" style={{ top: "130vw", height: "78.5vw" }} />
      </Column>

      {/* Right column. */}
      <Column drift={16} duration={16} animated={animated}>
        <ArtTile tile={TILES.cream} artworkUrl={artFor("cream")} className="left-[87vw] w-[51vw]" style={{ top: "42.5vw", height: "78.5vw" }} />
        <ArtTile tile={TILES.violet} artworkUrl={artFor("violet")} className="left-[87vw] w-[51vw]" style={{ top: "130vw", height: "78.5vw" }} />
      </Column>

      {/* Centre column — runs off the top of the screen and sits behind the brand. */}
      <Column drift={-10} duration={12} animated={animated}>
        <ArtTile tile={TILES.green} artworkUrl={artFor("green")} className="left-[24vw] w-[51vw]" style={{ top: "-25.5vw", height: "78.5vw" }} />
        <ArtTile tile={TILES.sun} artworkUrl={artFor("sun")} className="left-[24vw] w-[51vw]" style={{ top: "59.4vw", height: "78.5vw" }} />
      </Column>

      {/*
       * Scrim behind the brand and headline. The top tile is now a real picture and can be
       * bright anywhere, so the text cannot rely on a text-shadow alone. It fades out before
       * the second centre tile (which starts at 59.4vw) so that one stays at full strength.
       */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[62vw] bg-gradient-to-b from-black/65 via-black/45 to-transparent"
      />

      {/*
       * Brand mark and headline as ONE block. They used to be two absolutely positioned
       * elements, and only the logo had the status-bar inset added to its offset, so on any
       * phone with a notch or punch-hole the logo ran down into the headline. In a single flow
       * they cannot overlap whatever the inset, the font scale or the screen height.
       */}
      <div className="absolute inset-x-0 top-[calc(14vw+env(safe-area-inset-top))] flex flex-col items-center px-[5vw] text-center [text-shadow:0_1px_14px_rgb(0_0_0/0.55)]">
        <div className="flex items-center justify-center gap-2.5">
          <img src={appIcon} alt="" className="size-10 drop-shadow-lg" />
          <span className="text-[34px] font-semibold leading-none tracking-tight">WEAV</span>
        </div>
        <h1
          id="phone-welcome-title"
          className="mt-4 text-[clamp(22px,6.2vw,30px)] font-medium leading-[1.15] tracking-normal text-white"
        >
          Music for every moment
        </h1>
        <p className="mx-auto mt-2 max-w-[86vw] text-[clamp(14px,4vw,17px)] font-light leading-snug text-white/80">
          Stream, download and connect through music — your whole library in one place
        </p>
      </div>

      {/* Account row + actions. */}
      <div className="absolute inset-x-0 bottom-0 px-[8vw] pb-[max(1.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-black">
            {account?.artworkUrl ? (
              <img src={account.artworkUrl} alt="" className="size-full object-cover" />
            ) : (
              <img src={appIcon} alt="" className="size-8" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] leading-snug text-white">
              {name ? `Welcome back, ${name}` : "Welcome to WEAV"}
            </p>
            <p className="truncate text-[15px] font-light leading-snug text-white/60">
              {name ? "Pick up where you left off" : "Sign in to bring your library along"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSignIn}
          disabled={isBusy}
          aria-busy={isBusy}
          className={cn(
            "mt-5 flex h-[54px] w-full items-center justify-center gap-2.5 rounded-full bg-white",
            "text-[18px] font-normal text-[#111] transition-opacity",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08140f]",
            "active:opacity-90 disabled:pointer-events-none disabled:opacity-70",
          )}
        >
          {isBusy ? <SpinnerSteps size={18} /> : name ? null : <GoogleIcon size={19} />}
          <span className="truncate">
            {isBusy ? "Connecting…" : name ? `Continue as ${name}` : "Continue with Google"}
          </span>
        </button>

        <button
          type="button"
          onClick={name ? onSignIn : onSkip}
          disabled={isBusy}
          className="mt-2 flex h-14 w-full items-center justify-center text-[18px] font-normal text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50"
        >
          {name ? "Select another account" : "Skip for now"}
        </button>
      </div>
    </div>
  );
}
