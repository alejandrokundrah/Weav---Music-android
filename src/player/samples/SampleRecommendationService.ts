import type { Track } from "../../datasource/types";
import { logInternalWarn } from "../../internal/logging";
import type { LibraryController } from "../LibraryController";
import { getPlayHistory } from "../playHistory";
import type { SearchController } from "../SearchController";
import { buildTasteProfile, pickSeeds, primaryArtist, rankByTaste } from "../taste";
import { getQuicklySkippedSongIds } from "./analytics";
import { getHiddenSongIds } from "./hidden";
import type { SampleItem, SamplesApi, SamplesPage } from "./types";

const DEFAULT_PAGE_SIZE = 8;
const SAMPLE_SECONDS = 30;
/** Songs shorter than this are not worth sampling: the sample would be most of the song. */
const MIN_TRACK_SECONDS = 50;
const FALLBACK_QUERIES = ["new music", "popular songs", "indie mix", "electronic mix", "hip hop hits", "chill songs"];

interface Cursor {
  /** Which refill this is, so a different cursor is handed out each time. */
  page: number;
}

function encodeCursor(cursor: Cursor): string {
  return btoa(JSON.stringify(cursor));
}

function decodeCursor(value: string | null): Cursor {
  if (!value) return { page: 0 };
  try {
    const parsed = JSON.parse(atob(value));
    return typeof parsed?.page === "number" ? { page: parsed.page } : { page: 0 };
  } catch {
    return { page: 0 };
  }
}

/** Stable per song, so the same song always gets the same moment and a reload does not shuffle it. */
function hashToUnit(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

/**
 * Picks where in the song the sample starts: past the intro, before the outro, and
 * deterministically per song. A song's chorus usually lands between a quarter and half way in.
 */
export function pickSampleWindow(track: Track): { startTime: number; duration: number } {
  const total = track.durationSec;
  if (!total || total <= 0) return { startTime: 45, duration: SAMPLE_SECONDS };

  const duration = Math.min(SAMPLE_SECONDS, Math.max(15, Math.floor(total * 0.5)));
  const earliest = Math.min(15, Math.max(0, total - duration));
  const latest = Math.max(earliest, total - duration - 10);
  const preferred = total * (0.28 + hashToUnit(track.id) * 0.2);
  const startTime = Math.round(Math.min(latest, Math.max(earliest, preferred)));
  return { startTime, duration: Math.min(duration, Math.max(1, total - startTime)) };
}

export function toSampleItem(track: Track): SampleItem {
  const { startTime, duration } = pickSampleWindow(track);
  const artist = track.artists?.[0];
  return {
    id: `sample:${track.id}`,
    songId: track.id,
    title: track.title,
    artist: { id: artist?.id, name: artist?.name ?? track.artist },
    album: { id: track.albumId, name: track.album, artworkUrl: track.artworkUrl },
    startTime,
    duration,
    track,
  };
}

/**
 * The first, on-device implementation of the Samples feed API.
 *
 *   candidates  → recommendations seeded from taste + the Explore feed (trending, new releases)
 *   filtering   → hidden, repeatedly skipped, already served, too short, not playable
 *   scoring     → taste affinity with jitter, so refills differ
 *   selection   → interleaved so personal picks and fresh discoveries alternate
 *
 * It speaks the same `SamplesApi` a server would, including cursors, so the page does not know
 * or care where the feed comes from.
 */
export class SampleRecommendationService implements SamplesApi {
  private readonly served = new Set<string>();
  private pool: Track[] = [];

  constructor(
    private readonly libraryController: LibraryController,
    private readonly searchController: SearchController,
  ) {}

  async fetchSamples(cursor: string | null, limit = DEFAULT_PAGE_SIZE): Promise<SamplesPage> {
    const { page } = decodeCursor(cursor);
    if (page === 0) {
      // A fresh feed, not a continuation: songs served last time are fair game again.
      this.served.clear();
      this.pool = [];
    }

    if (this.pool.length < limit) {
      await this.refill();
    }

    const items: SampleItem[] = [];
    while (items.length < limit && this.pool.length > 0) {
      const track = this.pool.shift()!;
      if (this.served.has(track.id)) continue;
      this.served.add(track.id);
      items.push(toSampleItem(track));
    }

    return {
      items,
      // No more candidates after a refill means the catalogue is exhausted for now.
      nextCursor: items.length > 0 ? encodeCursor({ page: page + 1 }) : null,
    };
  }

  private async refill(): Promise<void> {
    const libraryState = this.libraryController.getState();
    const library = libraryState.library;
    const likedSongs = library?.likedSongs ?? [];
    const profile = buildTasteProfile(getPlayHistory(), likedSongs, library?.recentlyPlayed ?? []);

    const personal: Track[] = [];
    const discovery: Track[] = [];

    const sources: Array<Promise<void>> = [];
    if (profile.hasSignal) {
      for (const seed of pickSeeds(profile, 3)) {
        sources.push(
          this.libraryController
            .getRecommendations(seed)
            .then((tracks) => void personal.push(...tracks))
            .catch((error: unknown) => logInternalWarn("Samples seed recommendations failed", { error: String(error) })),
        );
      }
    }
    sources.push(
      this.libraryController
        .getBrowsePage("explore")
        .then((browse) => {
          for (const shelf of browse.shelves) discovery.push(...shelf.tracks);
        })
        .catch((error: unknown) => logInternalWarn("Samples explore feed failed", { error: String(error) })),
    );
    await Promise.all(sources);

    if (personal.length + discovery.length < 12) {
      const favourite = profile.topArtists[0];
      const query = favourite && Math.random() < 0.5
        ? `${favourite} mix`
        : FALLBACK_QUERIES[Math.floor(Math.random() * FALLBACK_QUERIES.length)];
      try {
        discovery.push(...await this.searchController.searchTracks(query));
      } catch (error) {
        logInternalWarn("Samples fallback search failed", { error: String(error) });
      }
    }

    const hidden = getHiddenSongIds();
    const skipped = getQuicklySkippedSongIds();
    const liked = new Set(likedSongs.map((track) => track.id));
    const usable = (track: Track) =>
      Boolean(track.id)
      && track.source !== "local"
      && !hidden.has(track.id)
      && !skipped.has(track.id)
      && !this.served.has(track.id)
      && (track.durationSec === undefined || track.durationSec >= MIN_TRACK_SECONDS);

    const seen = new Set<string>();
    const dedupe = (tracks: Track[]) => tracks.filter((track) => {
      if (!usable(track) || seen.has(track.id)) return false;
      seen.add(track.id);
      return true;
    });

    // Songs already in the library are the least "discovery" there is; they sink to the end.
    const rankedPersonal = rankByTaste(dedupe(personal), profile).sort(
      (left, right) => Number(liked.has(left.id)) - Number(liked.has(right.id)),
    );
    const rankedDiscovery = rankByTaste(dedupe(discovery), profile);

    // Alternate personal and discovery picks, with no artist twice in a row.
    const merged: Track[] = [];
    let lastArtist = "";
    const queues = [rankedPersonal, rankedDiscovery];
    let turn = 0;
    while (queues[0].length + queues[1].length > 0) {
      const queue = queues[turn % 2].length > 0 ? queues[turn % 2] : queues[(turn + 1) % 2];
      const repeatIndex = queue.findIndex((track) => primaryArtist(track) !== lastArtist);
      const [track] = queue.splice(repeatIndex >= 0 ? repeatIndex : 0, 1);
      merged.push(track);
      lastArtist = primaryArtist(track);
      turn += 1;
    }

    this.pool.push(...merged);
  }
}
