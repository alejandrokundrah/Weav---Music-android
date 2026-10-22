import { useEffect, useState } from "react";
import { RangeSlider } from "@/components/motion/range-slider";
import { VolumeLoudIcon, VolumeMutedIcon, VolumeSmallIcon } from "@/ui/icons";
import { playerController, shallowEqual, usePlayerSelector } from "../../../player/playerStore";
import { FloatingPanel } from "../FloatingPanel";
import { AzureVolumeIcon } from "../../skins/azure/azureIcons";

/** Scroll step over the icon, matching the old inline slider's wheel behaviour. */
const WHEEL_STEP_PERCENT = 5;

/**
 * Volume as a single icon that opens a slider on hover.
 *
 * The bar previously carried a permanently visible 96px slider for a control most people
 * touch rarely. Collapsing it to the icon returns that width to the track title, and the
 * slider is one hover away rather than hidden behind a click.
 *
 * The panel is portalled (see FloatingPanel): the player bar sits inside the window's
 * `overflow-hidden` root, so a panel positioned within the bar would be clipped by it.
 */
/** Azure's inline slider: a slim blue fill over a grey track, no thumb until hover. */
const INLINE_SLIDER = [
  "h-1 w-[99px] cursor-pointer appearance-none rounded-full bg-transparent",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full",
  "[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--azure-accent)_var(--slider-progress),var(--azure-track)_var(--slider-progress))]",
  "[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[var(--azure-track)]",
  "[&::-moz-range-progress]:h-1 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-[var(--azure-accent)]",
  "[&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
  "[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:opacity-0 hover:[&::-webkit-slider-thumb]:opacity-100",
  "focus-visible:[&::-webkit-slider-thumb]:opacity-100",
  "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white",
].join(" ");

/**
 * `popover` (default) is the icon that opens a slider on hover. `inline` is Azure's: the icon and
 * a short slider side by side, always visible, as in its design. `noir-inline` is Noir's take on
 * the same always-visible arrangement, with its own styling.
 */
export function VolumeControl({ variant = "popover" }: { variant?: "popover" | "inline" | "noir-inline" } = {}) {
  /* This component writes volume on every pointer move of the slider, so it is the last one
     that should be subscribed to fields it does not read. */
  const playerState = usePlayerSelector(
    (state) => ({ volume: state.volume, muted: state.muted }),
    shallowEqual,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [volume, setVolume] = useState(() => playerController.getVolume());
  const [isMuted, setIsMuted] = useState(() => playerController.isMuted());

  // The engine is the source of truth: the mini player and OS media keys change it too.
  useEffect(() => {
    setVolume(playerState.volume);
    setIsMuted(playerState.muted);
  }, [playerState.muted, playerState.volume]);

  const displayedVolume = isMuted ? 0 : volume;
  const percent = Math.round(displayedVolume * 100);

  const applyVolume = (nextPercent: number) => {
    const next = Math.min(1, Math.max(0, nextPercent / 100));
    setVolume(next);
    // Dragging to a level is itself an unmute; dragging to zero is a mute.
    setIsMuted(next === 0);
    void playerController.setVolume(next);
  };

  const toggleMute = () => {
    setIsMuted((muted) => !muted);
    void playerController.toggleMute();
  };

  if (variant === "inline") {
    return (
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={toggleMute}
          onWheel={(event) => {
            const delta = event.deltaY || event.deltaX;
            if (delta === 0) return;
            applyVolume(percent + (delta < 0 ? 1 : -1) * WHEEL_STEP_PERCENT);
          }}
          aria-label={isMuted ? `Unmute (volume ${percent}%)` : `Mute (volume ${percent}%)`}
          className={`flex h-8 items-center justify-center rounded-full transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isMuted ? "opacity-40" : ""}`}
        >
          <AzureVolumeIcon size={23} />
        </button>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={percent}
          onChange={(event) => applyVolume(Number(event.target.value))}
          onWheel={(event) => {
            const delta = event.deltaY || event.deltaX;
            if (delta === 0) return;
            applyVolume(percent + (delta < 0 ? 1 : -1) * WHEEL_STEP_PERCENT);
          }}
          className={INLINE_SLIDER}
          style={{ "--slider-progress": `${percent}%` } as React.CSSProperties}
          aria-label="Volume"
        />
      </div>
    );
  }

  const VolumeGlyph = isMuted
    ? VolumeMutedIcon
    : displayedVolume < 0.5
      ? VolumeSmallIcon
      : VolumeLoudIcon;

  if (variant === "noir-inline") {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={toggleMute}
          onWheel={(event) => {
            const delta = event.deltaY || event.deltaX;
            if (delta === 0) return;
            applyVolume(percent + (delta < 0 ? 1 : -1) * WHEEL_STEP_PERCENT);
          }}
          aria-label={isMuted ? `Unmute (volume ${percent}%)` : `Mute (volume ${percent}%)`}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <VolumeGlyph size={18} aria-hidden="true" />
        </button>
        {/* A plain range input: a thin line is all the design draws, and it stays keyboard- and
            screen-reader-operable for free. Styled in skins/noir/noir.css. */}
        <input
          type="range"
          className="noir-volume"
          min={0}
          max={100}
          step={1}
          value={percent}
          style={{ ["--noir-volume" as string]: `${percent}%` }}
          onChange={(event) => applyVolume(Number(event.target.value))}
          aria-label="Volume"
        />
      </div>
    );
  }

  return (
    <FloatingPanel
      open={isOpen}
      onOpenChange={setIsOpen}
      side="top"
      openOnHover
      triggerClassName="shrink-0"
      className="w-52"
      trigger={
        <button
          type="button"
          onClick={toggleMute}
          onWheel={(event) => {
            const delta = event.deltaY || event.deltaX;
            if (delta === 0) return;
            applyVolume(percent + (delta < 0 ? 1 : -1) * WHEEL_STEP_PERCENT);
          }}
          aria-label={isMuted ? `Unmute (volume ${percent}%)` : `Mute (volume ${percent}%)`}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <VolumeGlyph size={18} aria-hidden="true" />
        </button>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium text-foreground">
            {isMuted ? "Muted" : "Volume"}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">{percent}%</span>
        </div>
        <RangeSlider
          value={percent}
          onValueChange={applyVolume}
          min={0}
          max={100}
          step={1}
          showTicks={false}
          highlightAtMax={true}
          aria-label="Volume"
        />
      </div>
    </FloatingPanel>
  );
}
