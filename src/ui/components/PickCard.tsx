import type { MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PlayActiveIcon } from "@/ui/icons";
import { TrackArtwork } from "./TrackArtwork";

/** Rendered cover width in CSS pixels — only has to land in the right size bucket. */
const COVER_SIZE_PX = 160;

interface PickCardProps {
  artworkUrl?: string;
  title: string;
  subtitle?: string;
  /** Replaces the hover play button — the surprise tile uses it for an always-visible shuffle badge. */
  accessory?: ReactNode;
  disabled?: boolean;
  onSelect?: () => void;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
}

/**
 * A pick on the "Made for you" shelf: a square cover, with the title and artist beneath.
 *
 * A glass tile rather than a caption-on-art card. The cover stays clean, the text is always
 * legible whatever the picture is, and hover is one quick, physical move — the cover lifts and a
 * lime play button rises into its corner — all inside 200ms, because a card you are skimming past
 * should never read as lag.
 */
export function PickCard({
  artworkUrl,
  title,
  subtitle,
  accessory,
  disabled = false,
  onSelect,
  onContextMenu,
}: PickCardProps) {
  return (
    <div
      role="button"
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      aria-label={subtitle ? `${title} — ${subtitle}` : title}
      className={cn(
        "group/pick flex w-40 shrink-0 select-none flex-col gap-2 rounded-2xl p-2 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled ? "cursor-default opacity-60" : "cursor-pointer hover:bg-white/[0.08]",
      )}
      onClick={() => {
        if (!disabled) onSelect?.();
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.();
        }
      }}
      onContextMenu={onContextMenu}
    >
      <span
        className={cn(
          "relative block aspect-square w-full overflow-hidden rounded-xl bg-card shadow-md ring-1 ring-white/10",
          "transition-all duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          !disabled && "group-hover/pick:-translate-y-0.5 group-hover/pick:shadow-xl group-hover/pick:ring-white/25",
        )}
      >
        <TrackArtwork
          className="size-full transition-transform duration-200 ease-out group-hover/pick:scale-[1.04]"
          artworkUrl={artworkUrl}
          iconSize={44}
          size={COVER_SIZE_PX}
          variant="album"
        />
        <span
          className={cn(
            "pointer-events-none absolute bottom-2 right-2 grid size-10 place-items-center rounded-full",
            "bg-primary text-primary-foreground shadow-lg",
            "transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
            accessory
              ? "scale-100 opacity-100"
              : "translate-y-1 scale-90 opacity-0 group-hover/pick:translate-y-0 group-hover/pick:scale-100 group-hover/pick:opacity-100",
          )}
          aria-hidden="true"
        >
          {accessory ?? <PlayActiveIcon size={20} />}
        </span>
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 px-0.5">
        <span className="truncate text-sm font-medium text-foreground">{title}</span>
        {subtitle ? <span className="truncate text-xs text-muted-foreground">{subtitle}</span> : null}
      </span>
    </div>
  );
}
