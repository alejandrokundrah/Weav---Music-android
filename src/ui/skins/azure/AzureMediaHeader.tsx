import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/motion/tooltip";
import { SpinnerSteps } from "@/components/motion/loader";
import {
  CheckIcon,
  DownloadIcon,
  ListIcon,
  PlaylistAddIcon,
  RepeatActiveIcon,
  RepeatOneActiveIcon,
  ShuffleActiveIcon,
} from "@/ui/icons";
import { TrackArtwork } from "../../components/TrackArtwork";
import { describeCollectionDownload, type MediaHeaderProps } from "../../components/MediaHeader";
import { AzureHeadphonesIcon, AzureVerifiedIcon } from "./azureIcons";

/** A quiet round icon action beside the pills. */
const ROUND_ACTION =
  "grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-white transition-colors " +
  "hover:bg-white/20 disabled:pointer-events-none disabled:opacity-40 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Action({
  tooltip,
  label,
  onClick,
  disabled,
  pressed,
  children,
}: {
  tooltip: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={label}
        aria-pressed={pressed}
        className={cn(ROUND_ACTION, pressed && "text-[var(--azure-accent)]")}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/**
 * Azure's hero for the playlist, album and artist pages.
 *
 * Same props and same behaviour as the glass `MediaHeader` — it is handed the identical object —
 * laid out as the design's banner: a dark rounded card with the title on the left, a solid blue
 * PLAY pill beside whatever secondary action the page supplies (Follow, on an artist), and the
 * artwork running off the right edge, melting into the card's colour.
 *
 * No blur and no backdrop filter: the fade is a gradient mask.
 */
export function AzureMediaHeader({
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
  // An artist's photo is a portrait: it fills the right of the card. A cover is a square, so it
  // stands inside the card instead of being cropped to a banner.
  const isPortrait = circularArtwork;

  return (
    <header className="relative isolate flex min-h-[294px] items-center overflow-hidden rounded-[20px] bg-[#0d1d26]">
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        {artworkSlot ? (
          <div className="absolute inset-y-0 right-0 grid w-[48%] place-items-center">{artworkSlot}</div>
        ) : isPortrait ? (
          <div className="absolute inset-y-0 right-0 w-[62%] [mask-image:linear-gradient(to_right,transparent,#000_38%)]">
            <TrackArtwork
              className="size-full object-cover object-[60%_18%]"
              artworkUrl={artworkUrl}
              size={640}
              iconSize={0}
              loading="eager"
              variant="artist"
              preferProxy
            />
          </div>
        ) : (
          <div className="absolute right-10 top-1/2 size-[230px] -translate-y-1/2 overflow-hidden rounded-2xl shadow-2xl shadow-black/40 max-lg:hidden">
            <TrackArtwork
              className="size-full object-cover"
              artworkUrl={artworkUrl}
              size={360}
              iconSize={72}
              loading="eager"
              variant={artworkVariant}
            />
          </div>
        )}
        {/* Keeps white text legible whatever the picture turns out to be. */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(13_29_38/0.92)_0%,rgb(13_29_38/0.55)_45%,rgb(13_29_38/0)_75%)]" />
      </div>

      <div className="flex min-w-0 max-w-[34rem] flex-col gap-3 px-14 py-10">
        <span className="flex items-center gap-2.5 text-[17px] leading-5 text-[#d2d2d2]">
          {isPortrait && <AzureVerifiedIcon size={20} className="shrink-0 text-white" />}
          {eyebrow}
        </span>

        {/* Long titles clamp rather than push the actions off the card. */}
        <h1 className="line-clamp-2 text-[52px] font-bold leading-[1.06] tracking-[-0.02em] text-white">
          {title}
        </h1>

        {(subtitle || meta) && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[17px] text-[#d2d2d2]">
            {isPortrait && <AzureHeadphonesIcon size={20} className="shrink-0 text-white" />}
            {subtitle ? <div className="font-medium text-white">{subtitle}</div> : null}
            {subtitle && meta ? (
              <span aria-hidden="true" className="text-[#949494]">
                •
              </span>
            ) : null}
            {meta ? <p>{meta}</p> : null}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {playback ? (
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={playback.onToggle}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="flex h-12 min-w-[5.5rem] items-center justify-center gap-2 rounded-full bg-[var(--azure-accent)] px-6 text-base font-medium uppercase tracking-[0.06em] text-white transition-[transform,background-color] hover:bg-[#49c4e2] active:scale-95 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1d26]"
            >
              {isLoading ? <SpinnerSteps size={18} color="currentColor" /> : null}
              {isPlaying ? "Pause" : "Play"}
            </button>
          ) : null}

          <div data-azure-hero-actions="" className="flex items-center gap-2">
            {actions}
          </div>

          {onShuffle ? (
            <Action tooltip="Shuffle" label="Shuffle" onClick={onShuffle} disabled={actionsDisabled}>
              <ShuffleActiveIcon size={19} aria-hidden="true" />
            </Action>
          ) : null}

          {loop ? (
            <Action
              tooltip={loopMode === "repeat-one" ? "Loop current song" : "Loop the whole playlist"}
              label={
                loopMode === "repeat-one"
                  ? "Loop current song"
                  : loopMode === "repeat-all"
                    ? "Loop queue"
                    : "Play in loop"
              }
              onClick={isLooping && loop.onCycle ? loop.onCycle : loop.onPlay}
              disabled={actionsDisabled}
              pressed={isLooping}
            >
              {loopMode === "repeat-one" ? (
                <RepeatOneActiveIcon size={19} aria-hidden="true" />
              ) : (
                <RepeatActiveIcon size={19} aria-hidden="true" />
              )}
            </Action>
          ) : null}

          {onAddToPlaylist ? (
            <Action
              tooltip="Add every song here to a playlist"
              label="Add to playlist"
              onClick={onAddToPlaylist}
              disabled={actionsDisabled}
            >
              <PlaylistAddIcon size={19} aria-hidden="true" />
            </Action>
          ) : null}

          {onAddToQueue ? (
            <Action
              tooltip="Add every song here to the queue"
              label="Add to queue"
              onClick={onAddToQueue}
              disabled={actionsDisabled}
            >
              <ListIcon size={19} aria-hidden="true" />
            </Action>
          ) : null}

          {download
            ? (() => {
                const { allDownloaded, tooltip, label } = describeCollectionDownload(download.counts);

                return (
                  <Action
                    tooltip={tooltip}
                    label={label}
                    onClick={download.onStart}
                    disabled={actionsDisabled || allDownloaded || downloadBusy}
                  >
                    {downloadBusy ? (
                      <SpinnerSteps size={18} color="currentColor" />
                    ) : allDownloaded ? (
                      <CheckIcon size={19} aria-hidden="true" className="text-[var(--azure-accent)]" />
                    ) : (
                      <DownloadIcon size={19} aria-hidden="true" />
                    )}
                  </Action>
                );
              })()
            : null}
        </div>
      </div>
    </header>
  );
}
