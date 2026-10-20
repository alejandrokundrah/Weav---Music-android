import { useRef, useSyncExternalStore } from "react";
import { logInternalWarn } from "../../internal/logging";
import type { PlayerState } from "../PlayerController";
import type { PlayerControllerActions } from "../playerStore";
import { trackSampleEvent } from "./analytics";
import { hideSong } from "./hidden";
import type { SampleEventName, SampleItem, SamplesApi, SamplesState } from "./types";

const TICK_MS = 200;
/** How many samples the player queue holds: current plus what is warmed behind it. */
const QUEUE_WINDOW = 3;
const LOAD_MORE_THRESHOLD = 3;
const END_EPSILON_SEC = 0.2;

type Listener = () => void;

const INITIAL_STATE: SamplesState = {
  samples: [],
  activeIndex: 0,
  isPlaying: false,
  isBuffering: false,
  currentTime: 0,
  duration: 30,
  loading: false,
  loadingMore: false,
  cursor: null,
  error: null,
};

/**
 * The one place Samples playback is decided.
 *
 * It owns no audio of its own. The app already has a player with a gapless deck, a signed-URL
 * resolver and a media session, and a second engine fighting it for the speakers is exactly
 * what the feature must not do. So this drives `PlayerController` — one stream, one active
 * sample — and layers the sample semantics over it: start at `startTime`, stop at
 * `startTime + duration`, move on.
 *
 * UI state (which card is on screen) and playback state (what is audible) meet only here:
 * cards call `setActive`, and nothing in a card ever touches the player.
 */
export class SamplesController {
  private state: SamplesState = INITIAL_STATE;
  private readonly listeners = new Set<Listener>();
  private timer: number | null = null;
  /** Bumped on every activation and stop; a stale async step compares against it and bails. */
  private activation = 0;
  private userPaused = false;
  private seeked = false;
  private startedReported = false;
  private reportedMilestones = new Set<number>();
  private retriedFor: string | null = null;
  private activeStartedAt = 0;

  constructor(
    private readonly api: SamplesApi,
    private readonly player: PlayerControllerActions,
    private readonly getPlayerState: () => PlayerState,
  ) {}

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): SamplesState => this.state;

  private setState(patch: Partial<SamplesState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private get active(): SampleItem | undefined {
    return this.state.samples[this.state.activeIndex];
  }

  /* ── Feed ── */

  /** First load. Safe to call again: it resumes the existing feed instead of refetching it. */
  async loadSample(): Promise<void> {
    if (this.state.samples.length > 0) {
      await this.activate(this.state.activeIndex);
      return;
    }
    if (this.state.loading) return;
    this.setState({ loading: true, error: null });
    try {
      const page = await this.api.fetchSamples(null);
      this.setState({ samples: page.items, cursor: page.nextCursor, loading: false });
      if (page.items.length === 0) {
        this.setState({ error: "No samples are available right now." });
        return;
      }
      await this.activate(0);
    } catch (error) {
      logInternalWarn("Samples first page failed", { error: String(error) });
      this.setState({ loading: false, error: "Samples could not be loaded. Check your connection." });
    }
  }

  async retry(): Promise<void> {
    this.setState({ samples: [], cursor: null, activeIndex: 0, error: null });
    await this.loadSample();
  }

  async loadMore(): Promise<void> {
    const { cursor, loadingMore } = this.state;
    if (!cursor || loadingMore) return;
    this.setState({ loadingMore: true });
    try {
      const page = await this.api.fetchSamples(cursor);
      const known = new Set(this.state.samples.map((sample) => sample.id));
      // Appended, never replaced: the listener's position must not move.
      this.setState({
        samples: [...this.state.samples, ...page.items.filter((item) => !known.has(item.id))],
        cursor: page.nextCursor,
        loadingMore: false,
      });
    } catch (error) {
      // Everything already loaded stays usable; the next approach to the end tries again.
      logInternalWarn("Samples next page failed", { error: String(error) });
      this.setState({ loadingMore: false });
    }
  }

  /* ── Navigation ── */

  /** Called by the feed when a different card becomes the visible one. */
  setActive(index: number): void {
    if (index === this.state.activeIndex) return;
    if (index < 0 || index >= this.state.samples.length) return;
    this.finishActive("sample_skipped");
    void this.activate(index);
  }

  next(): void {
    if (this.state.activeIndex + 1 < this.state.samples.length) this.setActive(this.state.activeIndex + 1);
  }

  previous(): void {
    if (this.state.activeIndex > 0) this.setActive(this.state.activeIndex - 1);
  }

  /* ── Transport ── */

  async play(): Promise<void> {
    this.userPaused = false;
    this.setState({ isPlaying: true });
    await this.player.play();
  }

  async pause(): Promise<void> {
    this.userPaused = true;
    this.setState({ isPlaying: false });
    await this.player.pause();
  }

  async toggle(): Promise<void> {
    if (this.state.isPlaying) await this.pause();
    else await this.play();
  }

  /** `seconds` is within the sample, not the song. */
  async seek(seconds: number): Promise<void> {
    const sample = this.active;
    if (!sample) return;
    const clamped = Math.min(Math.max(0, seconds), sample.duration);
    this.setState({ currentTime: clamped });
    await this.player.seekTo(sample.startTime + clamped);
  }

  /** Leaving the page: silence, stop watching, keep the feed so coming back resumes it. */
  stop(): void {
    this.finishActive("sample_skipped");
    this.activation += 1;
    this.clearTimer();
    this.seeked = false;
    this.setState({ isPlaying: false, isBuffering: false });
    void this.player.pause();
  }

  /* ── Actions on the active song ── */

  hide(songId: string, event: SampleEventName = "sample_hidden"): void {
    hideSong(songId);
    const sample = this.state.samples.find((item) => item.songId === songId);
    trackSampleEvent(event, { sampleId: sample?.id, songId });
    const index = this.state.samples.findIndex((item) => item.songId === songId);
    if (index < 0) return;

    const wasActive = index === this.state.activeIndex;
    const samples = this.state.samples.filter((item) => item.songId !== songId);
    const activeIndex = Math.min(
      wasActive ? index : index < this.state.activeIndex ? this.state.activeIndex - 1 : this.state.activeIndex,
      Math.max(0, samples.length - 1),
    );
    this.setState({ samples, activeIndex });
    if (wasActive && samples.length > 0) {
      this.finishActive(null);
      void this.activate(activeIndex);
    }
  }

  track(event: SampleEventName, extra: Record<string, unknown> = {}): void {
    const sample = this.active;
    trackSampleEvent(event, { sampleId: sample?.id, songId: sample?.songId, ...extra });
  }

  /* ── Internals ── */

  private clearTimer(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Closes out the sample that was playing: its skip or completion is one event, once. */
  private finishActive(event: SampleEventName | null): void {
    const sample = this.active;
    if (!sample || !this.activeStartedAt) return;
    if (event) {
      trackSampleEvent(event, {
        sampleId: sample.id,
        songId: sample.songId,
        listenedSec: Math.round(((Date.now() - this.activeStartedAt) / 1000) * 10) / 10,
      });
    }
    this.activeStartedAt = 0;
  }

  private queueWindow(index: number) {
    return this.state.samples.slice(index, index + QUEUE_WINDOW).map((sample) => sample.track);
  }

  private async activate(index: number): Promise<void> {
    const sample = this.state.samples[index];
    if (!sample) return;

    const token = ++this.activation;
    this.clearTimer();
    this.seeked = false;
    this.startedReported = false;
    this.reportedMilestones = new Set();
    this.userPaused = false;
    this.activeStartedAt = Date.now();
    this.setState({
      activeIndex: index,
      currentTime: 0,
      duration: sample.duration,
      isBuffering: true,
      isPlaying: true,
    });
    trackSampleEvent("sample_impression", { sampleId: sample.id, songId: sample.songId });

    if (index >= this.state.samples.length - LOAD_MORE_THRESHOLD) void this.loadMore();

    // The previous sample is silenced by the player itself: playTrackById stops the engine
    // before the new stream is resolved, so two samples can never overlap.
    const started = await this.player.playTrackById(sample.songId, this.queueWindow(index), false);
    if (token !== this.activation) return;

    if (!started) {
      this.handleFailure(sample, index);
      return;
    }

    if (sample.startTime > 0) await this.player.seekTo(sample.startTime);
    if (token !== this.activation) return;
    this.seeked = true;

    this.timer = window.setInterval(() => this.tick(token), TICK_MS);
  }

  /** One retry for the same sample, then it is skipped — a bad song never stalls the feed. */
  private handleFailure(sample: SampleItem, index: number): void {
    trackSampleEvent("sample_error", { sampleId: sample.id, songId: sample.songId });
    if (this.retriedFor !== sample.id) {
      this.retriedFor = sample.id;
      void this.activate(index);
      return;
    }
    this.retriedFor = null;
    if (index + 1 < this.state.samples.length) {
      void this.activate(index + 1);
    } else {
      this.setState({ isPlaying: false, isBuffering: false });
      void this.loadMore();
    }
  }

  private tick(token: number): void {
    if (token !== this.activation) return;
    const sample = this.active;
    if (!sample) return;

    const playerState = this.getPlayerState();
    // The player moved on by itself (the song was shorter than expected): the sample is over.
    if (playerState.currentTrack && playerState.currentTrack.id !== sample.songId) {
      this.complete(sample);
      return;
    }
    if (playerState.status === "error") {
      this.clearTimer();
      this.handleFailure(sample, this.state.activeIndex);
      return;
    }

    const isPlaying = playerState.status === "playing";
    const isBuffering = playerState.status === "loading";
    if (isPlaying && !this.startedReported) {
      this.startedReported = true;
      trackSampleEvent("sample_started", { sampleId: sample.id, songId: sample.songId });
    }

    const elapsed = Math.min(
      sample.duration,
      Math.max(0, this.player.getCurrentTime() - sample.startTime),
    );
    for (const milestone of [25, 50]) {
      if (!this.reportedMilestones.has(milestone) && elapsed / sample.duration >= milestone / 100) {
        this.reportedMilestones.add(milestone);
        trackSampleEvent(milestone === 25 ? "sample_25_percent" : "sample_50_percent", {
          sampleId: sample.id,
          songId: sample.songId,
        });
      }
    }

    this.setState({
      currentTime: elapsed,
      isPlaying: this.userPaused ? false : isPlaying || isBuffering,
      isBuffering,
    });

    if (this.seeked && !this.userPaused && elapsed >= sample.duration - END_EPSILON_SEC) {
      this.complete(sample);
    }
  }

  private complete(sample: SampleItem): void {
    this.finishActive("sample_completed");
    this.retriedFor = null;
    const nextIndex = this.state.activeIndex + 1;
    if (nextIndex < this.state.samples.length) {
      void this.activate(nextIndex);
      return;
    }
    // Nothing queued behind it yet: loop the sample rather than going silent while the next
    // page loads.
    this.clearTimer();
    void this.loadMore();
    void this.activate(this.state.activeIndex);
    void sample;
  }
}

/** Reads a slice of the controller, re-rendering only when that slice changes. */
export function useSamplesState<T>(controller: SamplesController, select: (state: SamplesState) => T): T {
  const last = useRef<{ state: SamplesState; value: T } | null>(null);
  return useSyncExternalStore(controller.subscribe, () => {
    const state = controller.getState();
    if (last.current?.state === state) return last.current.value;
    const value = select(state);
    // Keep the previous reference when the slice is unchanged so unrelated ticks do not render.
    if (last.current && shallowEqualValue(last.current.value, value)) {
      last.current = { state, value: last.current.value };
      return last.current.value;
    }
    last.current = { state, value };
    return value;
  });
}

function shallowEqualValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || typeof right !== "object" || !left || !right) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => Object.is((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]));
}
