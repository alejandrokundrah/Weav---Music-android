import type { Track } from "../datasource/types";
import type { PlayHistoryEntry } from "./playHistory";

/**
 * A listener's taste, derived entirely on-device from what they played and liked.
 *
 * Plays decay with a 14-day half-life so the profile follows what you are into now rather than
 * what you played once a year ago. A like is worth three fresh plays: it is the only explicit
 * signal there is, and unlike a play it has no timestamp to decay by.
 */
export interface TasteProfile {
  /** Normalised artist name → weight in (0, 1], the favourite being 1. */
  artistAffinity: ReadonlyMap<string, number>;
  /** Artists in descending order of affinity. */
  topArtists: readonly string[];
  /** One representative track per weight, heaviest first. */
  weightedTracks: ReadonlyArray<{ track: Track; weight: number }>;
  /** Ids played in the last few hours; recommending them again is noise. */
  justPlayed: ReadonlySet<string>;
  /** True once there is enough signal to personalise anything. */
  hasSignal: boolean;
}

const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;
const LIKE_WEIGHT = 3;
const JUST_PLAYED_MS = 6 * 60 * 60 * 1000;
const MAX_PER_ARTIST = 4;

export function normalizeArtist(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export function primaryArtist(track: Track): string {
  return normalizeArtist(track.artists?.[0]?.name ?? track.artist.split(/,|&| x | feat\.?/i)[0] ?? "");
}

export function buildTasteProfile(
  history: readonly PlayHistoryEntry[],
  likedSongs: readonly Track[],
  recentlyPlayed: readonly Track[],
  now: number = Date.now(),
): TasteProfile {
  const trackWeight = new Map<string, { track: Track; weight: number }>();
  const artistWeight = new Map<string, number>();
  const justPlayed = new Set<string>();

  const add = (track: Track, weight: number) => {
    const entry = trackWeight.get(track.id);
    if (entry) entry.weight += weight;
    else trackWeight.set(track.id, { track, weight });

    const artist = primaryArtist(track);
    if (artist) artistWeight.set(artist, (artistWeight.get(artist) ?? 0) + weight);
  };

  for (const { track, playedAt } of history) {
    const age = Math.max(0, now - playedAt);
    add(track, Math.pow(0.5, age / HALF_LIFE_MS));
    if (age < JUST_PLAYED_MS) justPlayed.add(track.id);
  }
  for (const track of likedSongs) add(track, LIKE_WEIGHT);
  // YouTube's own history has no timestamps; a small flat weight so it still seeds taste
  // for someone who has not played anything in this app yet.
  for (const track of recentlyPlayed) add(track, 0.5);

  const maxArtist = Math.max(0, ...artistWeight.values());
  const artistAffinity = new Map<string, number>();
  for (const [artist, weight] of artistWeight) artistAffinity.set(artist, weight / maxArtist);

  const topArtists = [...artistWeight.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([artist]) => artist);

  return {
    artistAffinity,
    topArtists,
    weightedTracks: [...trackWeight.values()].sort((left, right) => right.weight - left.weight),
    justPlayed,
    hasSignal: trackWeight.size > 0,
  };
}

/**
 * Weighted-random seeds, favouring heavily played and liked tracks, at most one per artist so
 * three seeds do not all return the same artist's neighbourhood.
 */
export function pickSeeds(profile: TasteProfile, count: number, random = Math.random): Track[] {
  const pool = profile.weightedTracks.slice(0, 40).map((entry) => ({ ...entry }));
  const seeds: Track[] = [];
  const usedArtists = new Set<string>();

  while (seeds.length < count && pool.length > 0) {
    const eligible = pool.filter((entry) => !usedArtists.has(primaryArtist(entry.track)));
    const candidates = eligible.length > 0 ? eligible : pool;
    const total = candidates.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = random() * total;
    let chosen = candidates[candidates.length - 1];
    for (const entry of candidates) {
      roll -= entry.weight;
      if (roll <= 0) {
        chosen = entry;
        break;
      }
    }
    seeds.push(chosen.track);
    usedArtists.add(primaryArtist(chosen.track));
    pool.splice(pool.indexOf(chosen), 1);
  }
  return seeds;
}

/**
 * Orders candidates by how well they fit the profile: known artists first, a little jitter so
 * refreshes differ, anything just played pushed down, and no artist taking over the list.
 */
export function rankByTaste(
  candidates: readonly Track[],
  profile: TasteProfile,
  random = Math.random,
): Track[] {
  const scored = candidates.map((track) => {
    const affinity = profile.artistAffinity.get(primaryArtist(track)) ?? 0;
    const score = affinity + random() * 0.35 - (profile.justPlayed.has(track.id) ? 1 : 0);
    return { track, score };
  });
  scored.sort((left, right) => right.score - left.score);

  const perArtist = new Map<string, number>();
  const kept: Track[] = [];
  const overflow: Track[] = [];
  for (const { track } of scored) {
    const artist = primaryArtist(track);
    const seen = perArtist.get(artist) ?? 0;
    if (seen >= MAX_PER_ARTIST) overflow.push(track);
    else {
      perArtist.set(artist, seen + 1);
      kept.push(track);
    }
  }
  return [...kept, ...overflow];
}

/** The most-played track of an artist, to seed "Because you listen to …". */
export function seedForArtist(profile: TasteProfile, artist: string): Track | undefined {
  return profile.weightedTracks.find((entry) => primaryArtist(entry.track) === artist)?.track;
}
