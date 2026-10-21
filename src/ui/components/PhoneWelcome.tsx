import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { GoogleIcon } from "@/ui/icons";
import { SpinnerSteps } from "@/components/motion/loader";
import { libraryController } from "../../player/playerStore";
import type { GoogleAccountOption } from "../../datasource/types";
import { useReduceMotion } from "../settings/renderEffects";
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
 * Generic artwork. These are drawn, not licensed images: the screen sells the feeling of a big
 * catalogue without shipping anyone's album covers, and without a network request on first paint.
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

function ArtTile({ tile, className, style }: { tile: Tile; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      className={cn("absolute overflow-hidden rounded-[2.6vw]", className)}
      style={{ ...style, background: tile.background }}
    >
      {tile.rings && (
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
        <ArtTile tile={TILES.blue} className="left-[-33vw] w-[51vw]" style={{ top: "42.5vw", height: "78.5vw" }} />
        <ArtTile tile={TILES.navy} className="left-[-33vw] w-[51vw]" style={{ top: "130vw", height: "78.5vw" }} />
      </Column>

      {/* Right column. */}
      <Column drift={16} duration={16} animated={animated}>
        <ArtTile tile={TILES.cream} className="left-[87vw] w-[51vw]" style={{ top: "42.5vw", height: "78.5vw" }} />
        <ArtTile tile={TILES.violet} className="left-[87vw] w-[51vw]" style={{ top: "130vw", height: "78.5vw" }} />
      </Column>

      {/* Centre column — runs off the top of the screen and carries the brand. */}
      <Column drift={-10} duration={12} animated={animated}>
        <ArtTile tile={TILES.green} className="left-[24vw] w-[51vw]" style={{ top: "-25.5vw", height: "78.5vw" }} />
        <ArtTile tile={TILES.sun} className="left-[24vw] w-[51vw]" style={{ top: "59.4vw", height: "78.5vw" }} />
      </Column>

      {/* Brand mark over the top tile. */}
      <div className="absolute inset-x-0 top-[calc(20vw+env(safe-area-inset-top))] flex items-center justify-center gap-2.5">
        <img src={appIcon} alt="" className="size-10 drop-shadow-lg" />
        <span className="text-[34px] font-semibold leading-none tracking-tight">WEAV</span>
      </div>

      {/* Headline. Its own scrim keeps it readable where it crosses the bright top tile. */}
      <div className="absolute inset-x-0 top-[34vw] px-[5vw] text-center [text-shadow:0_1px_14px_rgb(0_0_0/0.45)]">
        <h1
          id="phone-welcome-title"
          className="text-[clamp(22px,6.2vw,30px)] font-medium leading-[1.15] tracking-normal text-white"
        >
          Music for every moment
        </h1>
        <p className="mx-auto mt-2 max-w-[86vw] text-[clamp(14px,4vw,17px)] font-light leading-snug text-white/70">
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
