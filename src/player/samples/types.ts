import type { Track } from "../../datasource/types";

/**
 * One entry of the Samples feed. The shape follows the documented `GET /api/samples` item so a
 * real backend can replace `SampleRecommendationService` without the UI changing.
 */
export interface SampleItem {
  id: string;
  songId: string;
  title: string;
  artist: { id?: string; name: string };
  album: { id?: string; name?: string; artworkUrl?: string };
  /**
   * A provider-supplied clip, when there is one. Absent today: the app streams the full song
   * and the controller seeks to `startTime`, which is why nothing is downloaded up front.
   */
  previewUrl?: string;
  /** Seconds into the song where the sample begins. */
  startTime: number;
  /** Seconds the sample plays for. */
  duration: number;
  /** The playable track the rest of the app understands. */
  track: Track;
}

export interface SamplesPage {
  items: SampleItem[];
  /** Opaque. Null when the feed has nothing more to give. */
  nextCursor: string | null;
}

/** The seam a server-side recommendation engine plugs into. */
export interface SamplesApi {
  fetchSamples(cursor: string | null, limit?: number): Promise<SamplesPage>;
}

export type SampleEventName =
  | "sample_impression"
  | "sample_started"
  | "sample_25_percent"
  | "sample_50_percent"
  | "sample_completed"
  | "sample_skipped"
  | "sample_liked"
  | "sample_unliked"
  | "sample_shared"
  | "sample_added_to_playlist"
  | "sample_added_to_queue"
  | "sample_hidden"
  | "sample_reported"
  | "sample_error"
  | "full_song_opened";

export interface SamplesState {
  samples: SampleItem[];
  activeIndex: number;
  isPlaying: boolean;
  isBuffering: boolean;
  /** Seconds into the sample, 0..duration. */
  currentTime: number;
  duration: number;
  loading: boolean;
  loadingMore: boolean;
  cursor: string | null;
  error: string | null;
}
