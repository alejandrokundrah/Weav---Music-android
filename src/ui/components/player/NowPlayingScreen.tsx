import { cn } from "@/lib/utils";
import {
  ArrowLeftIcon,
  HeartActiveIcon,
  HeartIcon,
  PauseActiveIcon,
  PlayActiveIcon,
  QueuePanelIcon,
  ShuffleActiveIcon,
  ShuffleIcon,
  SkipNextIcon,
  SkipPreviousIcon,
} from "@/ui/icons";
import {
  playerController,
  shallowEqual,
  useLibraryState,
  usePlayerSelector,
} from "../../../player/playerStore";
import { ArtistLinks } from "../ArtistLinks";
import { TrackArtwork } from "../TrackArtwork";
import { useTrackContextMenu } from "../TrackContextMenu";
import { SeekBar } from "./SeekBar";

interface NowPlayingScreenProps {
  onClose: () => void;
  onOpenQueue: () => void;
  onOpenLyrics: () => void;
}

const ROUND_BUTTON =
  "flex shrink-0 items-center justify-center rounded-full transition-[transform,background-color,opacity] active:scale-95 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The phone's full-screen player: blurred cover as the backdrop, the cover itself as a disc,
 * then title, seek bar and the transport with a lime play button.
 *
 * Opened by tapping the mini player bar. Everything it shows is read from the same player
 * store the desktop bar uses, so it cannot disagree with it.
 */
export function NowPlayingScreen({ onClose, onOpenQueue, onOpenLyrics }: NowPlayingScreenProps) {
  const state = usePlayerSelector(
    (player) => ({
      currentTrack: player.currentTrack,
      status: player.status,
      shuffleEnabled: player.shuffleEnabled,
    }),
    shallowEqual,
  );
  const libraryState = useLibraryState();
  const { toggleTrackLike } = useTrackContextMenu();

  const track = state.currentTrack;
  const isBusy = state.status === "loading";
  const isPlaying = state.status === "playing";

  const canLike = Boolean(track) && track?.source !== "local";
  const isLiked = Boolean(
    track && libraryState.library?.likedSongs.some((liked) => liked.id === track.id),
  );
  const isLikePending = Boolean(track && libraryState.pendingLikeTrackIds.has(track.id));

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background text-foreground">
      {/* Backdrop: the cover, blown up and blurred, fading into the page colour. */}
      {track?.artworkUrl && (
        <img
          src={track.artworkUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full scale-150 object-cover opacity-50 blur-3xl"
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/10 via-background/60 to-background"
      />

      <div className="relative flex min-h-0 flex-1 flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close player"
            className={cn(ROUND_BUTTON, "size-11 bg-white/15 text-foreground backdrop-blur")}
          >
            <ArrowLeftIcon size={20} />
          </button>
          <h1 className="text-base font-semibold">Now Playing</h1>
          <button
            type="button"
            onClick={() => track && void toggleTrackLike(track)}
            disabled={!canLike || isLikePending}
            aria-pressed={isLiked}
            aria-label={isLiked ? "Remove from liked songs" : "Add to liked songs"}
            className={cn(
              ROUND_BUTTON,
              "size-11 bg-white/15 backdrop-blur",
              isLiked ? "text-primary" : "text-foreground",
            )}
          >
            {isLiked ? <HeartActiveIcon size={20} /> : <HeartIcon size={20} />}
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6">
          <div className="aspect-square w-[min(72vw,20rem)] shrink-0 overflow-hidden rounded-full bg-card shadow-2xl">
            {track ? (
              <TrackArtwork
                className="size-full object-cover"
                size={512}
                artworkUrl={track.artworkUrl}
                iconSize={72}
                loading="eager"
              />
            ) : null}
          </div>

          <div className="flex w-full min-w-0 flex-col items-center gap-1 text-center">
            <p className="w-full truncate text-2xl font-semibold">
              {track?.title ?? "Nothing playing"}
            </p>
            {track && (
              <p className="w-full truncate text-sm text-muted-foreground">
                <ArtistLinks artists={track.artists} fallback={track.artist} />
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenLyrics}
            disabled={!track}
            className="rounded-full bg-white/10 px-5 py-2 text-sm font-medium text-foreground backdrop-blur transition-colors active:bg-white/20 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Lyrics
          </button>
        </div>

        <div className="flex flex-col gap-5">
          <SeekBar />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => playerController.toggleShuffle()}
              aria-pressed={state.shuffleEnabled}
              aria-label={state.shuffleEnabled ? "Turn off shuffle" : "Shuffle"}
              className={cn(
                ROUND_BUTTON,
                "size-11",
                state.shuffleEnabled ? "text-primary" : "text-muted-foreground",
              )}
            >
              {state.shuffleEnabled ? <ShuffleActiveIcon size={22} /> : <ShuffleIcon size={22} />}
            </button>

            <button
              type="button"
              onClick={() => void playerController.skipToPrevious()}
              disabled={!track}
              aria-label="Previous track"
              className={cn(ROUND_BUTTON, "size-12 bg-card text-foreground")}
            >
              <SkipPreviousIcon size={22} />
            </button>

            <button
              type="button"
              onClick={() => void playerController.togglePlayPause()}
              disabled={isBusy || !track}
              aria-label={isBusy ? "Loading song" : isPlaying ? "Pause" : "Play"}
              className={cn(ROUND_BUTTON, "size-[4.5rem] bg-primary text-primary-foreground")}
            >
              {isPlaying ? <PauseActiveIcon size={30} /> : <PlayActiveIcon size={30} />}
            </button>

            <button
              type="button"
              onClick={() => void playerController.skipToNext()}
              disabled={!track}
              aria-label="Next track"
              className={cn(ROUND_BUTTON, "size-12 bg-card text-foreground")}
            >
              <SkipNextIcon size={22} />
            </button>

            <button
              type="button"
              onClick={onOpenQueue}
              aria-label="Open queue"
              className={cn(ROUND_BUTTON, "size-11 text-muted-foreground")}
            >
              <QueuePanelIcon size={22} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
