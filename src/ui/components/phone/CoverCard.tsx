import {
  Children,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { TrackArtwork } from "../TrackArtwork";
import { GlassPlayGlyph } from "./PhoneIcons";

/** Corner radius on both card shapes, straight from the design. */
const CARD_RADIUS = 36;
/** Height of the frosted strip that carries the title and artist. */
const OVERLAY_HEIGHT = 61;

/**
 * The frosted round play button. A dark glass disc (blurred backdrop, a soft top-to-bottom
 * fade) with the gradient play triangle in it.
 */
export function GlassPlayButton({
  onClick,
  label,
  className,
  style,
}: {
  onClick: () => void;
  label: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={style}
      className={cn(
        "relative size-[41px] shrink-0 rounded-full backdrop-blur-[9px] transition-transform active:scale-90",
        "bg-[linear-gradient(180deg,rgba(7,4,9,0.5)_0%,rgba(73,73,73,0)_159%)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
        className,
      )}
    >
      <GlassPlayGlyph className="absolute inset-0 size-full" />
    </button>
  );
}

/**
 * `hero` is the big centred card in the carousel; `shelf` is the slightly taller card in the
 * rows below it. They share a shape and differ in proportions, shadow, glass tint and where
 * the play button sits — all three of which the design sets separately.
 */
export type CoverCardLayout = "hero" | "shelf";

const LAYOUT = {
  hero: {
    aspect: "191 / 202",
    // Warm bloom under the featured card. The colour is fixed, not sampled from the artwork.
    shadow: (p: string) => `0 30px 70px rgb(255 134 117 / calc(0.3 * (1 - var(${p}, 0))))`,
    glass: "linear-gradient(180deg, rgba(39,39,39,0.66) 0%, rgba(64,64,64,0.3) 100%)",
    blur: "backdrop-blur-[15px]",
    // The glass strip is flush with the card's bottom edge.
    lip: 0,
    play: "absolute right-[-3px] top-0",
    textPad: "pr-5",
  },
  shelf: {
    aspect: "191 / 208",
    shadow: () => "0 30px 50px rgb(0 0 0 / 0.4)",
    glass: "linear-gradient(180deg, rgba(28,28,28,0.73) 0%, rgba(59,59,59,0.33) 100%)",
    blur: "backdrop-blur-[16px]",
    // Here the strip hangs 4px below the artwork, which is what makes it read as a slab.
    lip: 4,
    play: "absolute bottom-2 right-4",
    textPad: "pr-[66px]",
  },
} as const;

interface CoverCardProps {
  layout: CoverCardLayout;
  title: string;
  subtitle?: string;
  artworkUrl?: string;
  variant?: "track" | "album" | "playlist";
  onOpen: () => void;
  /** The frosted play button. Omit for a card that has nothing to play directly. */
  onPlay?: () => void;
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
}

export function CoverCard({
  layout,
  title,
  subtitle,
  artworkUrl,
  variant = "track",
  onOpen,
  onPlay,
  onContextMenu,
}: CoverCardProps) {
  const spec = LAYOUT[layout];
  const radius = `${CARD_RADIUS}px`;

  return (
    <div
      className="relative w-full"
      style={{
        aspectRatio: spec.aspect,
        borderRadius: radius,
        boxShadow: spec.shadow("--p"),
      }}
      onContextMenu={onContextMenu}
    >
      <div
        className="absolute inset-0 overflow-hidden bg-[#1b1b1b]"
        style={{ borderRadius: radius }}
      >
        <TrackArtwork
          className="size-full text-white/30"
          size={256}
          iconSize={44}
          artworkUrl={artworkUrl}
          variant={variant}
        />
      </div>

      {/* Frosted strip. Its own layer, rather than a child of the clipped artwork box, so the
          shelf layout can let it hang past the bottom edge. */}
      <div
        className={cn(
          // pb-[3px] lifts the two-line block 1.5px, which is where the design sets it.
          "pointer-events-none absolute inset-x-0 flex flex-col justify-center pb-[3px] pl-[22px]",
          spec.blur,
          spec.textPad,
        )}
        style={{
          height: OVERLAY_HEIGHT,
          bottom: -spec.lip,
          background: spec.glass,
          borderRadius: `0 0 ${radius} ${radius}`,
        }}
      >
        <strong className="truncate text-sm font-normal leading-[18px] text-white">{title}</strong>
        {subtitle ? (
          <span className="truncate text-xs font-extralight leading-[18px] text-white">{subtitle}</span>
        ) : null}
      </div>

      {/* The whole card is one tap target; the play button sits above it. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={subtitle ? `${title}, ${subtitle}` : title}
        className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        style={{ borderRadius: radius }}
      />

      {onPlay && (
        <GlassPlayButton
          onClick={onPlay}
          label={`Play ${title}`}
          className={spec.play}
          // Only the centred card shows its button; it fades out as the card slides aside.
          style={{
            opacity: "calc(1 - var(--p, 0) * 1.6)",
            pointerEvents: "auto",
          }}
        />
      )}
    </div>
  );
}

export function CoverCardSkeleton({ layout }: { layout: CoverCardLayout }) {
  return (
    <div
      className="w-full animate-pulse bg-[#1b1b1b]"
      style={{ aspectRatio: LAYOUT[layout].aspect, borderRadius: CARD_RADIUS }}
      role="status"
      aria-label="Loading"
    />
  );
}

/* ── Carousel ─────────────────────────────────────────────────────── */

/** Layout gap between hero items. The visible gap is wider: side cards are scaled down. */
const HERO_GAP = 8;
/** Side cards are 159px against the centre's 191px. */
const SIDE_SCALE = 1 - 159 / 191;
/** Side cards sit 4.5px lower than the centre one. */
const SIDE_DROP = 4.5;

/**
 * A centre-snapping carousel where the card in the middle is full size and the ones either
 * side shrink, dim and drop a little.
 *
 * How far an item is from centre is written to each item as `--p` (0 at the middle, 1 a card
 * away) straight from the scroll handler, and CSS turns that into scale, opacity and shadow.
 * Nothing goes through React state, so scrolling does not re-render a single card.
 */
export function FocusCarousel({ children, label }: { children: ReactNode; label: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const items = Children.toArray(children);

  const update = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const middle = scroller.scrollLeft + scroller.clientWidth / 2;
    for (const node of Array.from(scroller.children)) {
      const item = node as HTMLElement;
      const centre = item.offsetLeft + item.offsetWidth / 2;
      const p = Math.min(1, Math.abs(centre - middle) / (item.offsetWidth + HERO_GAP));
      item.style.setProperty("--p", p.toFixed(3));
    }
  }, []);

  useLayoutEffect(update, [update, items.length]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    return () => {
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [update]);

  const handleScroll = () => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      update();
    });
  };

  /** Tapping a card that is off to the side brings it to the middle instead of opening it. */
  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>("[data-focus-item]");
    if (!item || Number(item.style.getPropertyValue("--p")) < 0.5) return;
    event.preventDefault();
    event.stopPropagation();
    item.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  return (
    <div
      ref={scrollerRef}
      role="group"
      aria-label={label}
      onScroll={handleScroll}
      onClickCapture={handleClickCapture}
      // Padded and pulled back by the same amount so the card shadows are not clipped by the
      // scroller, without moving anything around it.
      className="relative -mx-5 -mt-4 -mb-20 flex snap-x snap-mandatory overflow-x-auto pb-20 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ gap: HERO_GAP, paddingInline: "calc(50vw - var(--card-w) / 2)" }}
    >
      {items.map((child, index) => (
        <div
          key={index}
          data-focus-item=""
          className="shrink-0 snap-center will-change-transform"
          style={{
            width: "var(--card-w)",
            transform: `translateY(calc(var(--p, 0) * ${SIDE_DROP}px)) scale(calc(1 - var(--p, 0) * ${SIDE_SCALE.toFixed(4)}))`,
            opacity: "calc(1 - var(--p, 0) * 0.5)",
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

/** A plain horizontal row of cards, 24px apart, with the next one peeking in from the right. */
export function ShelfRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="relative -mx-5 -mb-20 -mt-4 flex snap-x overflow-x-auto scroll-pl-5 gap-6 px-5 pb-20 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {Children.map(children, (child) => (
        <div className="shrink-0 snap-start" style={{ width: "var(--card-w)" }}>
          {child}
        </div>
      ))}
    </div>
  );
}
