import type { ReactNode } from "react";
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
import { TrackArtwork } from "../../components/TrackArtwork";
import { describeCollectionDownload, type MediaHeaderProps } from "../../components/MediaHeader";

/** A quiet icon-only action: no ring, no fill, just a glyph that brightens on hover. */
const GHOST_ACTION =
  "grid size-10 place-items-center rounded-full text-muted-foreground transition-colors " +
  "hover:text-foreground disabled:pointer-events-none disabled:opacity-40 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Noir's hero for the playlist, album and artist pages.
 *
 * Same props and same behaviour as the glass `MediaHeader` — it is handed the identical object —
 * but laid out as a poster: the title and its actions on the left, and on the right the artwork
 * standing in an arch of red light that fades to black at its foot. The play button is the one
 * filled, coloured thing on the page.
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
}: MediaHeaderProps) {
  const isPlaying = playback?.isPlaying ?? false;
  const isLoading = playback?.isLoading ?? false;
  const downloadBusy = download?.isBusy ?? false;
  const loopMode = loop?.mode ?? "in-order";
  const isLooping = loopMode !== "in-order";
  // An artist's photo is a portrait and fills the arch; a cover is a square and does too, but
  // is asked for at the size the arch actually shows it.
  const isPortrait = circularArtwork;

  return (
    <header className="relative isolate flex items-end justify-between gap-12 pb-4 pt-10">
      <div className="flex min-w-0 max-w-[36rem] flex-1 flex-col gap-3 pb-8">
        <span className="text-[11px] font-light uppercase tracking-[0.2em] text-foreground/80">
          {eyebrow}
        </span>

        {/* Long titles clamp rather than push the actions off the row. */}
        <h1 className="line-clamp-3 text-[2.5rem] font-bold leading-[1.05] tracking-[-0.035em] text-foreground xl:text-5xl">
          {title}
        </h1>

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

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {playback ? (
            <Tooltip content={isPlaying ? "Pause" : "Play"}>
              <button
                type="button"
                disabled={actionsDisabled}
                onClick={playback.onToggle}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="mr-2 flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-[1.06] active:scale-95 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
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

          {loop ? (
            <Tooltip
              content={
                loopMode === "repeat-one"
                  ? "Loop current song"
                  : "Loop the whole playlist"
              }
            >
              <button
                type="button"
                disabled={actionsDisabled}
                onClick={isLooping && loop.onCycle ? loop.onCycle : loop.onPlay}
                aria-pressed={isLooping}
                aria-label={
                  loopMode === "repeat-one"
                    ? "Loop current song"
                    : loopMode === "repeat-all"
                      ? "Loop queue"
                      : "Play in loop"
                }
                className={cn(GHOST_ACTION, isLooping && "text-primary hover:text-primary")}
              >
                {loopMode === "repeat-one" ? (
                  <RepeatOneActiveIcon size={19} aria-hidden="true" />
                ) : (
                  <RepeatActiveIcon size={19} aria-hidden="true" />
                )}
              </button>
            </Tooltip>
          ) : null}

          {onAddToPlaylist ? (
            <Tooltip content="Add every song here to a playlist">
              <button
                type="button"
                disabled={actionsDisabled}
                onClick={onAddToPlaylist}
                aria-label="Add to playlist"
                className={GHOST_ACTION}
              >
                <PlaylistAddIcon size={19} aria-hidden="true" />
              </button>
            </Tooltip>
          ) : null}

          {onAddToQueue ? (
            <Tooltip content="Add every song here to the queue">
              <button
                type="button"
                disabled={actionsDisabled}
                onClick={onAddToQueue}
                aria-label="Add to queue"
                className={GHOST_ACTION}
              >
                <ListIcon size={19} aria-hidden="true" />
              </button>
            </Tooltip>
          ) : null}

          {download ? (() => {
            const { allDownloaded, tooltip, label } = describeCollectionDownload(download.counts);

            return (
              <Tooltip content={tooltip}>
                <button
                  type="button"
                  disabled={actionsDisabled || allDownloaded || downloadBusy}
                  onClick={download.onStart}
                  aria-busy={downloadBusy}
                  aria-label={label}
                  className={GHOST_ACTION}
                >
                  {downloadBusy ? (
                    <SpinnerSteps size={18} color="currentColor" />
                  ) : allDownloaded ? (
                    <CheckIcon size={19} aria-hidden="true" className="text-primary" />
                  ) : (
                    <DownloadIcon size={19} aria-hidden="true" />
                  )}
                </button>
              </Tooltip>
            );
          })() : null}

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
