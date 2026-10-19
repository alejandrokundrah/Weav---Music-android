import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The round controls and stroke glyphs shared by the phone's artist, album and playlist pages.
 *
 * They started life private to the artist page. Album and playlist draw the same
 * shuffle · play · queue row, so they live here once rather than as three copies that drift.
 */

/** A dark round button: `#1b1b1b` disc, light glyph, a press-in on tap. */
export function RoundButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-[#1b1b1b] text-[#e7e7e7] transition-transform active:scale-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ── Icons ────────────────────────────────────────────────────────── */
/* Stroke icons in the 1.5-weight, round-capped style of the phone nav glyphs. */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function ShuffleGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7h3.5c2.2 0 3.6 1 4.8 2.8l1.4 2.4c1.2 1.8 2.6 2.8 4.8 2.8H21" {...stroke} />
      <path d="M3 17h3.5c1.6 0 2.8-.5 3.8-1.5M13.5 8.5C14.5 7.5 15.7 7 17.3 7H21" {...stroke} />
      <path d="M18.5 4.5L21 7l-2.5 2.5M18.5 14.5L21 17l-2.5 2.5" {...stroke} />
    </svg>
  );
}

export function QueueGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h11M4 12h7M4 17h7" {...stroke} />
      <path d="M17 13v6M14 16h6" {...stroke} />
    </svg>
  );
}

export function PauseGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
    </svg>
  );
}

export function MoreGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5.5" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="18.5" r="1.4" fill="currentColor" />
    </svg>
  );
}
