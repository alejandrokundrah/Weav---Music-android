import { memo, useCallback, useRef, type MouseEvent, type ReactNode } from "react";
import { PlayActiveIcon } from "@/ui/icons";
import { propsEqualIgnoringHandlers } from "../../internal/propsEqual";
import { TrackArtwork } from "./TrackArtwork";

/**
 * Rendered card width in CSS pixels.
 *
 * The default covers the `minmax(9rem…9.5rem, 1fr)` grids these sit in. It only has to land in
 * the right size bucket, not be exact — a column stretched a little wider by `1fr` still
 * resolves to the same request.
 */
const DEFAULT_CARD_SIZE = 176;

interface AlbumCardProps {
  color?: string;
  artworkUrl?: string;
  title?: string;
  subtitle?: string;
  subtitleContent?: ReactNode;
  /** Override when the card is laid out at a materially different width. */
  size?: number;
  onClick?: () => void;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
}

/**
 * Memoised on everything except handler identity.
 *
 * Every grid that renders these hands them a fresh inline arrow, so a plain `memo` would never
 * once return true — a search keystroke or a hover elsewhere on the page rebuilt every card on
 * screen. `propsEqualIgnoringHandlers` skips those comparisons, which is only sound because
 * the handlers are invoked through a ref refreshed on each render: a card that *does* render
 * picks up the current closures, and a card that does not render is one whose every other prop
 * is unchanged.
 */
export const AlbumCard = memo(function AlbumCard({
  color = "#333333",
  artworkUrl,
  title,
  subtitle,
  subtitleContent,
  size = DEFAULT_CARD_SIZE,
  onClick,
  onContextMenu,
}: AlbumCardProps) {
  const handlersRef = useRef({ onClick, onContextMenu });
  handlersRef.current = { onClick, onContextMenu };

  const handleClick = useCallback(() => handlersRef.current.onClick?.(), []);
  const handleContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>) => handlersRef.current.onContextMenu?.(event),
    [],
  );
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") handlersRef.current.onClick?.();
  }, []);

  return (
    <div
      /*
       * Off-screen cards skip style, layout and paint — the same treatment `TrackRow` gets,
       * and for the same reason: these grids are not windowed, so a library page really does
       * build every card it has loaded. A card is heavier than a row (artwork, tilt wrapper,
       * hover overlay), which makes it the better candidate, not the worse one.
       *
       * `auto 232px` is a square cover at the ~176px grid column plus the two label lines. The
       * `auto` keyword means the guess only ever applies to a card that has not yet been on
       * screen once; after that the browser uses the size it actually measured.
       */
      className="group/card flex w-full cursor-pointer flex-col gap-2 rounded-2xl p-2 transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [content-visibility:auto] [contain-intrinsic-size:auto_232px]"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl shadow-md ring-1 ring-white/10 transition-all duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover/card:-translate-y-0.5 group-hover/card:shadow-xl group-hover/card:ring-white/25" style={{ backgroundColor: color }}>
        <TrackArtwork
          className="size-full object-cover transition-transform duration-200 ease-out group-hover/card:scale-[1.04]"
          artworkUrl={artworkUrl}
          iconSize={48}
          size={size}
          variant="album"
        />
        {/* Play affordance rises into the corner on hover rather than sitting on the art. */}
        <span
          className="pointer-events-none absolute bottom-2 right-2 grid size-10 translate-y-1 scale-90 place-items-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg transition-[transform,opacity] duration-150 group-hover/card:translate-y-0 group-hover/card:scale-100 group-hover/card:opacity-100"
          aria-hidden="true"
        >
          <PlayActiveIcon size={20} />
        </span>
      </div>

      {title && (
        <span className="line-clamp-2 text-sm font-medium text-foreground">{title}</span>
      )}
      {(subtitleContent || subtitle) && (
        <span className="line-clamp-1 text-xs text-muted-foreground">
          {subtitleContent ?? subtitle}
        </span>
      )}
    </div>
  );
}, propsEqualIgnoringHandlers);
