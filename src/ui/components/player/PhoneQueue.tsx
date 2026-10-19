import { useMemo, useState } from "react";
import { ArrowLeftIcon, CloseIcon } from "@/ui/icons";
import { playerController, usePlayerSelector, usePlayerSessionSelector, shallowEqual } from "../../../player/playerStore";
import type { Track } from "../../../datasource/types";
import { PhonePill, PhoneSongRow } from "../phone/PhoneParts";
import { TrackArtwork } from "../TrackArtwork";
import { queueSliceEqual, selectQueueSlice } from "./QueuePanel";

const AUTOMATIC_PAGE_SIZE = 30;

interface Entry {
  track: Track;
  absoluteIndex: number;
  key: string;
}

function formatRemaining(entries: Entry[]): string | null {
  let seconds = 0;
  for (const { track } of entries) {
    if (!track.durationSec) return null;
    seconds += track.durationSec;
  }
  if (seconds === 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`;
}

/**
 * The phone's queue: a full-screen sheet in the Home/Artist visual language — the playing
 * track in a #1b1b1b card, then "Next up" and "Autoplay" as plain song rows. Rows play on tap
 * and carry a remove button; there is no drag-to-reorder (the desktop panel keeps that).
 */
export function PhoneQueue({ onClose }: { onClose: () => void }) {
  const { queue, queueIndex, manualQueueLength, queueWindowStart } = usePlayerSessionSelector(
    selectQueueSlice,
    queueSliceEqual,
  );
  const { currentTrack, status } = usePlayerSelector(
    (player) => ({ currentTrack: player.currentTrack, status: player.status }),
    shallowEqual,
  );
  const [visibleAutomatic, setVisibleAutomatic] = useState(AUTOMATIC_PAGE_SIZE);

  const { manual, automatic } = useMemo(() => {
    const start = Math.max(queueIndex + 1, 0);
    const manualEntries: Entry[] = [];
    const automaticEntries: Entry[] = [];
    const seen = new Map<string, number>();
    for (let offset = 0; start + offset < queue.length; offset += 1) {
      const track = queue[start + offset];
      const occurrence = seen.get(track.id) ?? 0;
      seen.set(track.id, occurrence + 1);
      const entry: Entry = {
        track,
        absoluteIndex: queueWindowStart + start + offset,
        key: occurrence === 0 ? track.id : `${track.id}:${occurrence}`,
      };
      (offset < manualQueueLength ? manualEntries : automaticEntries).push(entry);
    }
    return { manual: manualEntries, automatic: automaticEntries };
  }, [manualQueueLength, queue, queueIndex, queueWindowStart]);

  const upcoming = manual.length + automatic.length;
  const remaining = useMemo(() => formatRemaining([...manual, ...automatic]), [manual, automatic]);
  const shownAutomatic = automatic.slice(0, visibleAutomatic);

  const renderRow = (entry: Entry) => (
    <PhoneSongRow
      key={entry.key}
      track={entry.track}
      onSelect={() => void playerController.playQueueTrackAt(entry.absoluteIndex)}
      trailing={
        <button
          type="button"
          onClick={() => playerController.removeFromQueueAt(entry.absoluteIndex)}
          aria-label={`Remove ${entry.track.title} from queue`}
          className="grid size-10 shrink-0 place-items-center rounded-full text-[#929292] transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <CloseIcon size={16} aria-hidden="true" />
        </button>
      }
    />
  );

  return (
    <div className="font-lexend fixed inset-0 z-[60] flex flex-col bg-[#131313] pt-[env(safe-area-inset-top)] text-white animate-in fade-in slide-in-from-bottom duration-200">
      <header className="flex items-center gap-3 px-5 pb-2 pt-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to player"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-[#1b1b1b] text-[#e7e7e7] transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <ArrowLeftIcon size={20} aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-col">
          <h1 className="text-[26px] font-semibold leading-8 tracking-normal text-white">Queue</h1>
          <p className="truncate text-xs font-extralight text-[#929292]">
            {upcoming === 0 ? "Nothing queued" : `${upcoming} songs${remaining ? ` · ${remaining}` : ""}`}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {currentTrack && (
          <section className="mt-6 flex flex-col gap-4">
            <h2 className="text-2xl font-medium leading-none tracking-normal text-[#e7e7e7]">Now playing</h2>
            <div className="flex items-center gap-4 rounded-3xl bg-[#1b1b1b] p-3">
              <TrackArtwork
                className="size-16 shrink-0 rounded-2xl bg-[#131313]"
                size={64}
                iconSize={24}
                artworkUrl={currentTrack.artworkUrl}
                loading="eager"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-base font-medium text-white">{currentTrack.title}</span>
                <span className="truncate text-xs font-extralight text-[#929292]">{currentTrack.artist}</span>
              </span>
              <span className="mr-2 shrink-0 text-xs font-light text-[#929292]">
                {status === "playing" ? "Playing" : "Paused"}
              </span>
            </div>
          </section>
        )}

        {upcoming > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            <PhonePill onPress={() => playerController.shuffleUpcomingQueue()}>Shuffle next</PhonePill>
            <PhonePill onPress={() => playerController.clearUpcomingQueue()}>Clear queue</PhonePill>
          </div>
        )}

        {manual.length > 0 && (
          <section className="mt-8 flex flex-col gap-3">
            <h2 className="text-2xl font-medium leading-none tracking-normal text-[#e7e7e7]">Next up</h2>
            <div className="flex flex-col gap-1">{manual.map(renderRow)}</div>
          </section>
        )}

        {automatic.length > 0 && (
          <section className="mt-8 flex flex-col gap-3">
            <h2 className="text-2xl font-medium leading-none tracking-normal text-[#e7e7e7]">
              {manual.length > 0 ? "Autoplay" : "Next up"}
            </h2>
            <div className="flex flex-col gap-1">{shownAutomatic.map(renderRow)}</div>
            {automatic.length > visibleAutomatic && (
              <PhonePill
                className="self-start"
                onPress={() => setVisibleAutomatic((count) => count + AUTOMATIC_PAGE_SIZE)}
              >
                Show {Math.min(AUTOMATIC_PAGE_SIZE, automatic.length - visibleAutomatic)} more
              </PhonePill>
            )}
          </section>
        )}

        {upcoming === 0 && (
          <p className="mt-16 text-center text-sm font-light text-[#929292]">
            Nothing is queued. Add songs from any song's menu.
          </p>
        )}
      </div>
    </div>
  );
}
