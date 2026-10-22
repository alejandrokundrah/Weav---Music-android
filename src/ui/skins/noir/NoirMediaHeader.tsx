import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/motion/tooltip";
import { SpinnerSteps } from "@/components/motion/loader";
import {
  CheckIcon,
  DownloadIcon,
  ListIcon,
  PauseActiveIcon,
  PlayActiveIcon,
  PlaylistAddIcon,
  RepeatActiveIcon,
  RepeatOneActiveIcon,
  ShuffleActiveIcon,
} from "@/ui/icons";
import { MenuDotsIcon } from "@solar-icons/react/linear/menu-dots";
import { TrackArtwork } from "../../components/TrackArtwork";
import { FloatingPanel } from "../../components/FloatingPanel";
import { describeCollectionDownload, type MediaHeaderProps } from "../../components/MediaHeader";

/** A quiet icon-only action: no ring, no fill, just a glyph that brightens on hover. */
const GHOST_ACTION =
  "grid size-10 place-items-center rounded-full text-muted-foreground transition-colors " +
  "hover:text-foreground disabled:pointer-events-none disabled:opacity-40 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const MENU_ROW =
  "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-foreground transition-colors " +
  "hover:bg-card disabled:pointer-events-none disabled:opacity-40 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/**
 * Noir's hero for the playlist, album and artist pages.
 *
 * Same props and same behaviour as the glass `MediaHeader` — it is handed the identical object —
 * but laid out as the design draws it: a small kicker, the title, a line of description and a line
 * of facts on the left, then exactly three controls — a red play button, shuffle and a "more"
 * menu — and on the right the artwork standing in an arch of red light that fades to black.
 *
 * Everything the glass hero shows as its own button (loop, add to a playlist, add to the queue,
 * download) is still here; it lives in the "more" menu so the row stays as quiet as the design.
 *
 * No blur and no backdrop filter, deliberately: the arch is a gradient and a mask.
 */
export function NoirMediaHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  artworkUrl,
  artworkVariant = "playlist",
  artworkSlot,
  circularArtwork = false,
  playback,
  onShuffle,
  onAddToQueue,
  onAddToPlaylist,
  download,
  loop,
  actionsDisabled = false,
  actions,
  descriptionSlot,
}: MediaHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isPlaying = playback?.isPlaying ?? false;
  const isLoading = playback?.isLoading ?? false;
  const downloadBusy = download?.isBusy ?? false;
  const loopMode = loop?.mode ?? "in-order";
  const isLooping = loopMode !== "in-order";
  // An artist's photo is a portrait and fills the arch; a cover is a square and does too, but
  // is asked for at the size the arch actually shows it.
  const isPortrait = circularArtwork;

  const downloadInfo = download ? describeCollectionDownload(download.counts) : null;
  const hasMenu = Boolean(loop || onAddToPlaylist || onAddToQueue || download);
  const closeThen = (action: (() => void) | undefined) => () => {
    setIsMenuOpen(false);
    action?.();
  };

  return (
    <header className="relative isolate flex items-end justify-between gap-12 pb-4 pt-8">
      <div className="flex min-w-0 max-w-[34rem] flex-1 flex-col gap-3 pb-8">
        <span className="text-[11px] font-light uppercase tracking-[0.2em] text-foreground/80">
          {eyebrow}
        </span>

        {/* Long titles clamp rather than push the actions off the row. */}
        <h1 className="line-clamp-3 text-[2.5rem] font-bold leading-[1.05] tracking-[-0.035em] text-foreground xl:text-5xl">
          {title}
        </h1>

        {descriptionSlot ? (
          <div className="max-w-[26rem] text-[13px] leading-relaxed">{descriptionSlot}</div>
        ) : null}

        {(subtitle || meta) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            {subtitle ? <div className="font-semibold text-foreground">{subtitle}</div> : null}
            {subtitle && meta ? (
              <span aria-hidden="true" className="text-muted-foreground/60">
                •
              </span>
            ) : null}
            {meta ? <p className="text-muted-foreground">{meta}</p> : null}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1">
          {playback ? (
            <Tooltip content={isPlaying ? "Pause" : "Play"}>
              <button
                type="button"
                disabled={actionsDisabled}
                onClick={playback.onToggle}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="mr-3 flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-[1.06] active:scale-95 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                {isLoading ? (
                  <SpinnerSteps size={22} color="currentColor" />
                ) : isPlaying ? (
                  <PauseActiveIcon size={22} aria-hidden="true" />
                ) : (
                  <PlayActiveIcon size={22} aria-hidden="true" />
                )}
              </button>
            </Tooltip>
          ) : null}

          {onShuffle ? (
            <Tooltip content="Shuffle">
              <button
                type="button"
                disabled={actionsDisabled}
                onClick={onShuffle}
                aria-label="Shuffle"
                className={GHOST_ACTION}
              >
                <ShuffleActiveIcon size={19} aria-hidden="true" />
              </button>
            </Tooltip>
          ) : null}

          {hasMenu ? (
            <FloatingPanel
              open={isMenuOpen}
              onOpenChange={setIsMenuOpen}
              side="bottom"
              className="w-64"
              trigger={
                <Tooltip content="More">
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen((open) => !open)}
                    aria-haspopup="menu"
                    aria-expanded={isMenuOpen}
                    aria-label="More options"
                    className={cn(GHOST_ACTION, isLooping && "text-primary hover:text-primary")}
                  >
                    <MenuDotsIcon size={22} aria-hidden="true" />
                  </button>
                </Tooltip>
              }
            >
              <div className="flex flex-col gap-0.5" role="menu">
                {loop ? (
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={isLooping}
                    disabled={actionsDisabled}
                    className={MENU_ROW}
                    onClick={closeThen(isLooping && loop.onCycle ? loop.onCycle : loop.onPlay)}
                  >
                    {loopMode === "repeat-one" ? (
                      <RepeatOneActiveIcon size={16} aria-hidden="true" className="text-primary" />
                    ) : (
                      <RepeatActiveIcon
                        size={16}
                        aria-hidden="true"
                        className={cn(isLooping && "text-primary")}
                      />
                    )}
                    {loopMode === "repeat-one"
                      ? "Looping this song"
                      : loopMode === "repeat-all"
                        ? "Looping the queue"
                        : "Play in loop"}
                  </button>
                ) : null}

                {onAddToPlaylist ? (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={actionsDisabled}
                    className={MENU_ROW}
                    onClick={closeThen(onAddToPlaylist)}
                  >
                    <PlaylistAddIcon size={16} aria-hidden="true" />
                    Add all to a playlist
                  </button>
                ) : null}

                {onAddToQueue ? (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={actionsDisabled}
                    className={MENU_ROW}
                    onClick={closeThen(onAddToQueue)}
                  >
                    <ListIcon size={16} aria-hidden="true" />
                    Add all to the queue
                  </button>
                ) : null}

                {download && downloadInfo ? (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={actionsDisabled || downloadInfo.allDownloaded || downloadBusy}
                    aria-busy={downloadBusy}
                    title={downloadInfo.tooltip}
                    className={MENU_ROW}
                    onClick={closeThen(download.onStart)}
                  >
                    {downloadBusy ? (
                      <SpinnerSteps size={16} color="currentColor" />
                    ) : downloadInfo.allDownloaded ? (
                      <CheckIcon size={16} aria-hidden="true" className="text-primary" />
                    ) : (
                      <DownloadIcon size={16} aria-hidden="true" />
                    )}
                    {downloadInfo.allDownloaded ? "Downloaded" : downloadInfo.label}
                  </button>
                ) : null}
              </div>
            </FloatingPanel>
          ) : null}

          {actions}
        </div>
      </div>

      {/*
        The arch. Hidden when the window is narrow rather than shrunk: a thumbnail-sized arch
        reads as a mistake, and the title is what the page is for.
      */}
      <Arch artworkUrl={artworkUrl} variant={artworkVariant} isPortrait={isPortrait} slot={artworkSlot} />
    </header>
  );
}

function Arch({
  artworkUrl,
  variant,
  isPortrait,
  slot,
}: {
  artworkUrl?: string;
  variant: NonNullable<MediaHeaderProps["artworkVariant"]>;
  isPortrait: boolean;
  slot?: ReactNode;
}) {
  return (
    <div
      className="relative hidden h-[19rem] w-[15.5rem] shrink-0 md:block xl:h-[22rem] xl:w-[18rem]"
      aria-hidden="true"
    >
      {/*
        Red light and the picture share one masked, rounded-crown box so the picture can multiply
        into the red (a blend only sees what is inside its own stacking context) and both melt
        into black together at the foot.
      */}
      <div className="absolute inset-0 overflow-hidden rounded-t-[999px] [mask-image:linear-gradient(to_bottom,#000_62%,transparent_100%)]">
        <div className="noir-arch absolute inset-0" />
        {slot ? (
          <div className="absolute inset-0 grid place-items-center">{slot}</div>
        ) : (
          <TrackArtwork
            className={cn(
              "absolute inset-0 size-full object-cover mix-blend-multiply",
              isPortrait && "object-[50%_18%]",
            )}
            artworkUrl={artworkUrl}
            size={isPortrait ? 640 : 360}
            iconSize={72}
            loading="eager"
            variant={isPortrait ? "artist" : variant}
            preferProxy={isPortrait}
          />
        )}
      </div>
    </div>
  );
}
