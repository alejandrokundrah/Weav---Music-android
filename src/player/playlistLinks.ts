/**
 * Reading a pasted Spotify, SoundCloud or Apple Music playlist link.
 *
 * Pure text handling only: recognising the link, and turning the public page behind it into a
 * list of "title by artist". The fetching lives in playlistLinkImport.ts, because that needs
 * Tauri and this has to run under node for its self-check.
 *
 * None of these services offers a key-free API for reading a playlist, so the pages themselves
 * are the source. Each page embeds its track list as JSON, which is more stable than scraping
 * markup but is still not a contract — when a service reshapes it, the parser here is what
 * has to change, and the self-check holds a fixture of each shape to say so.
 */

export type PlaylistProvider = "spotify" | "soundcloud" | "apple";

export interface PlaylistLink {
  provider: PlaylistProvider;
  /** Spotify's 22-character id, Apple's `pl.…` id, or SoundCloud's `user/slug`. */
  id: string;
  /** The URL to fetch, with tracking parameters and locale prefixes removed. */
  url: string;
}

/** A song as the other service described it, before it is matched to anything on YouTube. */
export interface ImportedTrackRef {
  title: string;
  artist: string;
  durationSec?: number;
}

export type PlaylistLinkErrorCode =
  | "unsupported"
  | "not-found"
  | "private"
  | "blocked"
  | "unreadable"
  | "network"
  | "cancelled";

export class PlaylistLinkError extends Error {
  readonly code: PlaylistLinkErrorCode;

  constructor(code: PlaylistLinkErrorCode, message: string) {
    super(message);
    this.name = "PlaylistLinkError";
    this.code = code;
  }
}

export interface ParsedPlaylistPage {
  title: string;
  tracks: ImportedTrackRef[];
  /**
   * How many songs the playlist has, when the page says. A page that lists fewer than this is
   * only showing part of it, and the caller owes the person a warning rather than a silent
   * short playlist.
   */
  total?: number;
}

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  // Spotify joins artists with a no-break space, which survives into search queries as a
  // character YouTube treats as part of the word.
  return value.replace(/[  ​]/g, " ").replace(/\s+/g, " ").trim();
}

function toSeconds(value: unknown, unit: "ms" | "s" = "ms"): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(unit === "ms" ? value / 1000 : value);
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function metaContent(html: string, property: string): string {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
    "i",
  );
  return decodeHtml(html.match(pattern)?.[1] ?? "").trim();
}

// ---------------------------------------------------------------------------------------------
// Recognising a link
// ---------------------------------------------------------------------------------------------

function toUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

/** Whether `input` is a playlist link we can read, and if so which service and which playlist. */
export function detectPlaylistLink(input: string): PlaylistLink | null {
  const trimmed = input.trim();

  const uri = trimmed.match(/^spotify:playlist:([A-Za-z0-9]{22})$/);
  if (uri) {
    return { provider: "spotify", id: uri[1], url: `https://open.spotify.com/playlist/${uri[1]}` };
  }

  const url = toUrl(trimmed);
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "open.spotify.com") {
    // `/intl-de/playlist/…` is what Spotify copies for some locales; `/embed/` is the share
    // dialog's embed code. Both are the same playlist.
    const rest = segments.filter((part) => !/^intl-[a-z]{2}(-[a-z]{2})?$/i.test(part) && part !== "embed");
    if (rest[0] !== "playlist" || !SPOTIFY_ID.test(rest[1] ?? "")) return null;
    return { provider: "spotify", id: rest[1], url: `https://open.spotify.com/playlist/${rest[1]}` };
  }

  if (host === "music.apple.com") {
    // /{storefront}/playlist/{slug}/pl.{id}
    const at = segments.indexOf("playlist");
    if (at === -1) return null;
    const id = segments.slice(at + 1).find((part) => /^pl\.[A-Za-z0-9-]+$/.test(part));
    if (!id) return null;
    const storefront = at > 0 && /^[a-z]{2}$/i.test(segments[0]) ? segments[0].toLowerCase() : "us";
    const slug = segments[at + 1] && segments[at + 1] !== id ? segments[at + 1] : "playlist";
    return {
      provider: "apple",
      id,
      url: `https://music.apple.com/${storefront}/playlist/${slug}/${id}`,
    };
  }

  if (host === "soundcloud.com") {
    // /{user}/sets/{slug}, optionally followed by the secret token of a private link.
    if (segments.length < 3 || segments[1] !== "sets") return null;
    const [user, , slug, secret] = segments;
    const path = [user, "sets", slug, ...(secret ? [secret] : [])].join("/");
    return { provider: "soundcloud", id: `${user}/${slug}`, url: `https://soundcloud.com/${path}` };
  }

  return null;
}

/** Why a link that is not a readable playlist is not one — worth saying, since it is often close. */
export function describeUnsupportedLink(input: string): string {
  const url = toUrl(input);
  const host = url?.hostname.toLowerCase().replace(/^(www|m)\./, "") ?? "";
  const first = url?.pathname.split("/").filter(Boolean).find((part) => !/^intl-/i.test(part)) ?? "";

  if (host === "on.soundcloud.com" || host === "spoti.fi" || host === "link.tospotify.com") {
    return "That is a shortened link. Open it in a browser and paste the full address.";
  }
  if (host === "open.spotify.com" || host === "music.apple.com" || host === "soundcloud.com") {
    if (/^(album|track|artist|show|episode)$/.test(first) || /^(album|song|artist)$/.test(first)) {
      return "That link is not a playlist. Paste a playlist link.";
    }
    return "That does not look like a playlist link.";
  }
  return "Paste a Spotify, SoundCloud or Apple Music playlist link.";
}

// ---------------------------------------------------------------------------------------------
// Spotify
// ---------------------------------------------------------------------------------------------

/** Spotify's embed page shows at most this many songs of a playlist without signing in. */
export const SPOTIFY_EMBED_LIMIT = 100;

function readNextData(html: string): unknown {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/** Songs found by walking anything that looks like one, for when the named path has moved. */
function collectSpotifyTracks(root: unknown): ImportedTrackRef[] {
  const found: ImportedTrackRef[] = [];
  const seen = new Set<string>();

  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const record = node as Record<string, unknown>;
    const uri = typeof record.uri === "string" ? record.uri : "";
    const title = cleanText(record.title ?? record.name);
    if (uri.startsWith("spotify:track:") && title) {
      const key = uri;
      if (!seen.has(key)) {
        seen.add(key);
        const artists = Array.isArray(record.artists)
          ? record.artists
              .map((artist) => cleanText(typeof artist === "string" ? artist : (artist as { name?: unknown })?.name))
              .filter(Boolean)
              .join(", ")
          : "";
        found.push({
          title,
          artist: cleanText(record.subtitle ?? record.artist) || artists,
          durationSec: toSeconds(record.duration ?? record.duration_ms),
        });
      }
      return;
    }
    for (const value of Object.values(record)) visit(value);
  };

  visit(root);
  return found;
}

export function parseSpotifyEmbed(html: string): ParsedPlaylistPage {
  const data = readNextData(html) as {
    props?: { pageProps?: { status?: number; title?: string; state?: { data?: { entity?: Record<string, unknown> } } } };
  } | null;

  if (!data) {
    if (/private/i.test(html)) {
      throw new PlaylistLinkError("private", "That Spotify playlist is private. Make it public, then try again.");
    }
    throw new PlaylistLinkError("unreadable", "Could not read that Spotify playlist.");
  }

  const pageProps = data.props?.pageProps;
  if (pageProps?.status === 404) {
    throw new PlaylistLinkError("not-found", "Spotify could not find that playlist.");
  }

  const entity = pageProps?.state?.data?.entity;
  const title = cleanText(entity?.name ?? entity?.title ?? pageProps?.title) || "Spotify playlist";

  let tracks: ImportedTrackRef[] = [];
  const trackList = entity?.trackList;
  if (Array.isArray(trackList)) {
    tracks = trackList
      .map((item) => {
        const record = item as Record<string, unknown>;
        return {
          title: cleanText(record.title ?? record.name),
          artist: cleanText(record.subtitle ?? record.artist),
          durationSec: toSeconds(record.duration ?? record.duration_ms),
        };
      })
      .filter((track) => track.title);
  }
  if (!tracks.length) tracks = collectSpotifyTracks(data);

  if (!tracks.length) {
    if (/private/i.test(JSON.stringify(pageProps ?? {}))) {
      throw new PlaylistLinkError("private", "That Spotify playlist is private. Make it public, then try again.");
    }
    throw new PlaylistLinkError("unreadable", "Spotify did not list any songs for that playlist.");
  }

  const reported = typeof entity?.totalCount === "number" ? entity.totalCount : undefined;
  return { title, tracks, total: reported };
}

// ---------------------------------------------------------------------------------------------
// Apple Music
// ---------------------------------------------------------------------------------------------

/** "PT3M20S" → 200. Apple writes durations as ISO 8601. */
export function parseIsoDuration(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)$/);
  if (!match) return undefined;
  const seconds = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  return seconds > 0 ? Math.round(seconds) : undefined;
}

function artistNames(value: unknown): string {
  if (Array.isArray(value)) return value.map(artistNames).filter(Boolean).join(", ");
  if (typeof value === "string") return cleanText(value);
  if (value && typeof value === "object") return cleanText((value as { name?: unknown }).name);
  return "";
}

function findJsonLd(html: string): Record<string, unknown> | null {
  const blocks = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const block of blocks) {
    try {
      const parsed: unknown = JSON.parse(block[1]);
      const candidates = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { "@graph"?: unknown })?.["@graph"])
          ? ((parsed as { "@graph": unknown[] })["@graph"])
          : [parsed];
      for (const candidate of candidates) {
        const record = candidate as Record<string, unknown> | null;
        if (record && (record["@type"] === "MusicPlaylist" || Array.isArray(record.track))) return record;
      }
    } catch {
      // Not this block.
    }
  }
  return null;
}

function tracksFromJsonLd(playlist: Record<string, unknown>): ImportedTrackRef[] {
  if (!Array.isArray(playlist.track)) return [];
  return playlist.track
    .map((item) => {
      const record = item as Record<string, unknown>;
      return {
        title: cleanText(record.name),
        artist: artistNames(record.byArtist) || artistNames(record.artist),
        durationSec: parseIsoDuration(record.duration),
      };
    })
    .filter((track) => track.title);
}

/** Songs in Apple's own page data: anything with a title and an `artistName`. */
function tracksFromServerData(html: string): ImportedTrackRef[] {
  const match = html.match(/<script[^>]*id=["']serialized-server-data["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return [];
  let root: unknown;
  try {
    root = JSON.parse(match[1]);
  } catch {
    return [];
  }

  const found: ImportedTrackRef[] = [];
  const seen = new Set<string>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const record = node as Record<string, unknown>;
    const title = cleanText(record.title);
    const artist = cleanText(record.artistName);
    // A song row, not an album or an artist tile: those carry `artistName` too, but they are
    // never given a duration.
    const duration = toSeconds(record.duration ?? record.durationInMillis);
    if (title && artist && duration) {
      const key = `${title}\u0000${artist}`;
      if (!seen.has(key)) {
        seen.add(key);
        found.push({ title, artist, durationSec: duration });
      }
      return;
    }
    for (const value of Object.values(record)) visit(value);
  };
  visit(root);
  return found;
}

export function parseAppleMusicPage(html: string): ParsedPlaylistPage {
  const ld = findJsonLd(html);
  const fromLd = ld ? tracksFromJsonLd(ld) : [];
  const fromData = tracksFromServerData(html);

  // Whichever source saw more songs is the one that was not truncated; on a tie the one that
  // knows the artists wins, since a title alone matches the wrong song far too often.
  const ldHasArtists = fromLd.some((track) => track.artist);
  const dataHasArtists = fromData.some((track) => track.artist);
  let tracks = fromLd;
  if (fromData.length > fromLd.length || (fromData.length === fromLd.length && dataHasArtists && !ldHasArtists)) {
    tracks = fromData;
  }

  if (!tracks.length) {
    throw new PlaylistLinkError("unreadable", "Could not read any songs from that Apple Music playlist.");
  }

  const title = cleanText(ld?.name)
    || metaContent(html, "og:title").replace(/\s+on Apple Music$/i, "").trim()
    || "Apple Music playlist";
  return { title, tracks };
}

// ---------------------------------------------------------------------------------------------
// SoundCloud
// ---------------------------------------------------------------------------------------------

/** A song SoundCloud's page named only by id; its details have to be asked for. */
export interface PendingTrack {
  pendingId: string;
}

export interface ParsedSoundCloudPage {
  title: string;
  /** In playlist order. Entries still to be resolved are `PendingTrack`s. */
  slots: Array<ImportedTrackRef | PendingTrack>;
}

function isPending(slot: ImportedTrackRef | PendingTrack): slot is PendingTrack {
  return "pendingId" in slot;
}

function soundCloudTrack(record: Record<string, unknown>): ImportedTrackRef | null {
  const title = cleanText(record.title);
  if (!title) return null;
  const metadata = record.publisher_metadata as { artist?: unknown } | undefined;
  const user = record.user as { username?: unknown } | undefined;
  return {
    title,
    artist: cleanText(metadata?.artist) || cleanText(user?.username),
    durationSec: toSeconds(record.full_duration ?? record.duration),
  };
}

export function parseSoundCloudPage(html: string): ParsedSoundCloudPage {
  const match = html.match(/window\.__sc_hydration\s*=\s*(\[[\s\S]*?\])\s*;?\s*<\/script>/);
  if (!match) {
    throw new PlaylistLinkError("unreadable", "Could not read that SoundCloud playlist.");
  }
  let hydration: unknown;
  try {
    hydration = JSON.parse(match[1]);
  } catch {
    throw new PlaylistLinkError("unreadable", "Could not read that SoundCloud playlist.");
  }

  const entry = Array.isArray(hydration)
    ? (hydration as Array<{ hydratable?: string; data?: Record<string, unknown> }>).find(
        (item) => item?.hydratable === "playlist",
      )
    : undefined;
  const data = entry?.data;
  if (!data || !Array.isArray(data.tracks)) {
    throw new PlaylistLinkError("unreadable", "That SoundCloud link is not a playlist.");
  }

  const slots: Array<ImportedTrackRef | PendingTrack> = [];
  for (const item of data.tracks as Array<Record<string, unknown>>) {
    const track = soundCloudTrack(item);
    if (track) slots.push(track);
    else if (item?.id !== undefined && item.id !== null) slots.push({ pendingId: String(item.id) });
  }

  if (!slots.length) {
    throw new PlaylistLinkError("unreadable", "That SoundCloud playlist has no songs.");
  }
  return { title: cleanText(data.title) || "SoundCloud playlist", slots };
}

export function pendingSoundCloudIds(page: ParsedSoundCloudPage): string[] {
  return page.slots.filter(isPending).map((slot) => slot.pendingId);
}

/**
 * Fills the pending slots from what the follow-up request returned, keeping playlist order.
 * Songs that could not be resolved (removed, private, or the request failed) are counted rather
 * than dropped silently.
 */
export function resolveSoundCloudSlots(
  page: ParsedSoundCloudPage,
  fetched: ReadonlyMap<string, ImportedTrackRef>,
): { tracks: ImportedTrackRef[]; unresolved: number } {
  const tracks: ImportedTrackRef[] = [];
  let unresolved = 0;
  for (const slot of page.slots) {
    if (!isPending(slot)) {
      tracks.push(slot);
      continue;
    }
    const resolved = fetched.get(slot.pendingId);
    if (resolved) tracks.push(resolved);
    else unresolved += 1;
  }
  return { tracks, unresolved };
}

/** The `<script src>` bundles on a SoundCloud page, newest last — the id is in one of them. */
export function findSoundCloudScripts(html: string): string[] {
  return [...html.matchAll(/<script[^>]+src=["'](https:\/\/a-v2\.sndcdn\.com\/assets\/[^"']+\.js)["']/g)].map(
    (match) => match[1],
  );
}

export function extractSoundCloudClientId(script: string): string | null {
  const match = script.match(/client_id\s*[:=]\s*["']([A-Za-z0-9]{32})["']/);
  return match ? match[1] : null;
}

/** Converts one `/tracks?ids=` result into the shape the rest of the importer uses. */
export function soundCloudApiTrack(record: unknown): { id: string; track: ImportedTrackRef } | null {
  if (!record || typeof record !== "object") return null;
  const item = record as Record<string, unknown>;
  const track = soundCloudTrack(item);
  if (!track || item.id === undefined || item.id === null) return null;
  return { id: String(item.id), track };
}

export const __parseForTest = {
  cleanText,
  decodeHtml,
  collectSpotifyTracks,
  tracksFromJsonLd,
  tracksFromServerData,
};
