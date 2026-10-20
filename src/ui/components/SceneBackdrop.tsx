import { memo } from "react";
import { cn } from "@/lib/utils";

/**
 * The scenery behind the glass window: a dusk valley — sage sky, layered ridgelines, a lake,
 * dark foreground foliage — in the logo's palette: WEAV lime on charcoal. Original illustration, drawn as one static SVG so it costs nothing
 * to ship and nothing to repaint.
 *
 * `blurred` renders the same picture softened, for the *inside* of the shell. That is the whole
 * frosted-glass effect: a pre-blurred copy of what is behind the pane, rather than a live
 * `backdrop-filter` (which WebKitGTK composites badly — see global.css).
 */
export const SceneBackdrop = memo(function SceneBackdrop({
  blurred = false,
  className,
}: {
  blurred?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      data-fx={blurred ? "ambient" : undefined}
      className={cn("pointer-events-none overflow-hidden", className)}
    >
      <svg
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        className={cn("size-full", blurred && "origin-center scale-110 blur-[26px] saturate-[1.25]")}
      >
        <defs>
          <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6c7860" />
            <stop offset="0.45" stopColor="#454c3f" />
            <stop offset="1" stopColor="#2a2d26" />
          </linearGradient>
          <linearGradient id="sc-ridge-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7b8576" />
            <stop offset="1" stopColor="#565d51" />
          </linearGradient>
          <linearGradient id="sc-ridge-mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#474c44" />
            <stop offset="1" stopColor="#2f332d" />
          </linearGradient>
          <linearGradient id="sc-hill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#92D906" />
            <stop offset="1" stopColor="#46474C" />
          </linearGradient>
          <linearGradient id="sc-lake" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5a6a55" />
            <stop offset="1" stopColor="#23261f" />
          </linearGradient>
          <radialGradient id="sc-glow" cx="0.5" cy="0.15" r="0.6">
            <stop offset="0" stopColor="#f1f8d4" stopOpacity="0.28" />
            <stop offset="1" stopColor="#f1f8d4" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="1600" height="1000" fill="url(#sc-sky)" />
        <rect width="1600" height="700" fill="url(#sc-glow)" />

        {/* Cloud banks */}
        <g fill="#eef2e0" opacity="0.3">
          <ellipse cx="260" cy="150" rx="260" ry="46" />
          <ellipse cx="470" cy="190" rx="190" ry="34" />
          <ellipse cx="1180" cy="120" rx="300" ry="42" />
          <ellipse cx="1420" cy="175" rx="200" ry="30" />
        </g>

        {/* Far ridge */}
        <path
          d="M0 470 C 120 400 220 360 330 390 C 430 420 480 330 600 300 C 700 275 760 340 860 360
             C 980 385 1050 300 1170 290 C 1290 280 1380 350 1600 330 L1600 1000 L0 1000 Z"
          fill="url(#sc-ridge-far)"
          opacity="0.85"
        />
        {/* Mid ridge */}
        <path
          d="M0 560 C 140 500 260 470 380 510 C 500 550 560 470 700 450 C 820 432 900 500 1020 520
             C 1160 545 1260 470 1380 470 C 1480 470 1550 500 1600 520 L1600 1000 L0 1000 Z"
          fill="url(#sc-ridge-mid)"
        />
        {/* Green hill, left */}
        <path
          d="M0 640 C 110 580 230 560 340 600 C 430 632 480 700 560 740 L560 1000 L0 1000 Z"
          fill="url(#sc-hill)"
        />
        {/* Lake */}
        <path
          d="M420 760 C 560 700 760 690 960 705 C 1180 722 1400 700 1600 730 L1600 1000 L380 1000 Z"
          fill="url(#sc-lake)"
        />
        <g stroke="#cfe39a" strokeOpacity="0.28" strokeWidth="2" strokeLinecap="round">
          <path d="M700 790 h140" />
          <path d="M920 830 h200" />
          <path d="M1180 780 h120" />
          <path d="M780 880 h260" />
        </g>
        {/* Right bank */}
        <path
          d="M1180 700 C 1300 660 1460 650 1600 690 L1600 1000 L1130 1000 C 1150 880 1150 780 1180 700 Z"
          fill="#2e3b17"
        />
        {/* Foreground foliage */}
        <g fill="#15170f">
          <path d="M0 1000 L0 780 C 60 800 90 850 150 860 C 130 910 160 960 120 1000 Z" />
          <path d="M60 1000 C 80 900 150 850 230 880 C 300 910 330 960 320 1000 Z" />
          <path d="M1600 1000 L1600 760 C 1540 790 1500 840 1440 850 C 1470 910 1440 960 1480 1000 Z" />
          <path d="M1380 1000 C 1390 920 1450 880 1520 900 C 1580 920 1600 960 1600 1000 Z" />
        </g>
        <g fill="#1f2417" opacity="0.9">
          <path d="M200 1000 C 220 940 280 920 340 950 C 380 970 400 990 410 1000 Z" />
          <path d="M1250 1000 C 1270 950 1330 930 1380 960 C 1410 975 1420 990 1425 1000 Z" />
        </g>
      </svg>
      {/* Settles the lower third so the player has somewhere dark to sit. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
    </div>
  );
});
