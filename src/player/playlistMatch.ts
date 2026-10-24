/**
 * Choosing which YouTube Music result is "the same song" as one from another service.
 *
 * Search returns the right song most of the time and a cover, a live cut, a karaoke version or
 * a different song by the same artist the rest. Taking the first result puts those in the
 * person's playlist silently, which is worse than a gap they can see — so each candidate is
 * scored, and a song with no candidate good enough is reported as not found instead.
 *
 * Pure, so it can be checked under node.
 */

export interface MatchTarget {
  title: string;
  artist: string;
  durationSec?: number;
}

export interface MatchCandidate {
  title: string;
  artist: string;
  artists?: Array<{ name: string }>;
  durationSec?: number;
}

/** Below this the result is more likely a different song than a variant spelling of this one. */
export const MATCH_THRESHOLD = 0.55;

/** Words that make a result a *version* of the song. Fine if the original had it, wrong if not. */
const VERSION_WORDS = [
  "karaoke",
  "instrumental",
  "cover",
  "remix",
  "live",
  "acoustic",
  "slowed",
  "sped",
  "reverb",
  "nightcore",
  "tribute",
  "8d",
];

function fold(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Comparable words of a title. Credits and format notes are stripped, because services disagree
 * about them: "Song (feat. X)" on one and "Song" on the other is the same song.
 */
export function titleTokens(title: string): string[] {
  const stripped = fold(title)
    .replace(/[([{][^)\]}]*\b(feat|ft|featuring|with|prod)\b[^)\]}]*[)\]}]/g, " ")
    .replace(/\s[-–—]\s(feat|ft|featuring|with)\.?\s.*$/g, " ")
    .replace(/[([{]\s*(official|lyrics?|audio|video|hd|hq|visuali[sz]er|explicit|clean|remaster(ed)?(\s\d{4})?)[^)\]}]*[)\]}]/g, " ")
    .replace(/\s[-–—]\s(remaster(ed)?|\d{4} remaster(ed)?)\b.*$/g, " ");
  return stripped.replace(/&/g, " and ").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

export function artistTokens(artist: string): string[] {
  return fold(artist)
    .replace(/&/g, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word && word !== "and" && word !== "feat" && word !== "ft" && word !== "x");
}

/** Share of `a`'s words found in `b`, in 0–1. Asymmetric on purpose: see `overlap` callers. */
function covered(a: string[], b: string[]): number {
  if (!a.length) return 0;
  const pool = new Set(b);
  return a.filter((word) => pool.has(word)).length / a.length;
}

/** Dice coefficient over word sets: penalises a candidate padded with extra words. */
function dice(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let shared = 0;
  for (const word of setA) if (setB.has(word)) shared += 1;
  return (2 * shared) / (setA.size + setB.size);
}

export function scoreMatch(target: MatchTarget, candidate: MatchCandidate): number {
  const targetTitle = titleTokens(target.title);
  const candidateTitle = titleTokens(candidate.title);
  const titleScore = dice(targetTitle, candidateTitle);
  if (titleScore === 0) return 0;

  const targetArtists = artistTokens(target.artist);
  const candidateArtists = artistTokens(
    [candidate.artist, ...(candidate.artists ?? []).map((artist) => artist.name)].join(" "),
  );
  // With no artist to compare, the title has to carry the match on its own, so it is neither
  // rewarded nor punished for it.
  const artistScore = targetArtists.length ? covered(targetArtists, candidateArtists) : 0.5;

  let score = 0.62 * titleScore + 0.3 * artistScore;

  if (target.durationSec && candidate.durationSec) {
    const gap = Math.abs(target.durationSec - candidate.durationSec);
    if (gap <= 3) score += 0.12;
    else if (gap <= 10) score += 0.04;
    else if (gap > 30) score -= 0.25;
    else if (gap > 15) score -= 0.1;
  }

  const wanted = new Set([...targetTitle, ...targetArtists]);
  const haystack = new Set([...candidateTitle, ...candidateArtists]);
  for (const word of VERSION_WORDS) {
    if (haystack.has(word) && !wanted.has(word)) score -= 0.2;
  }

  return Math.max(0, score);
}

export function pickBestMatch<T extends MatchCandidate>(
  target: MatchTarget,
  candidates: readonly T[],
): { match: T; score: number } | null {
  let best: { match: T; score: number } | null = null;
  for (const candidate of candidates) {
    const score = scoreMatch(target, candidate);
    // Strictly greater: search already ranks by relevance, so on a tie the earlier result wins.
    if (!best || score > best.score) best = { match: candidate, score };
  }
  return best && best.score >= MATCH_THRESHOLD ? best : null;
}

/** Search queries to try for a song, most specific first. */
export function searchQueries(target: MatchTarget): string[] {
  const title = target.title.trim();
  const firstArtist = target.artist.split(/\s*(?:,|&|\bfeat\.?\b|\bft\.?\b|\bx\b)\s*/i)[0]?.trim() ?? "";
  const queries = [firstArtist ? `${firstArtist} ${title}` : title];
  if (firstArtist) queries.push(title);
  return [...new Set(queries)];
}
