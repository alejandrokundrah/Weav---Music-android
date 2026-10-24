import { tauriFetch } from "../datasource/youtube/tauriFetch";
import type { Playlist, Track } from "../datasource/types";
import { logInternalInfo, logInternalWarn } from "../internal/logging";
import { libraryController, searchController } from "./playerStore";
import {
  PlaylistLinkError,
  SPOTIFY_EMBED_LIMIT,
  extractSoundCloudClientId,
  findSoundCloudScripts,
  parseAppleMusicPage,
  parseSoundCloudPage,
  parseSpotifyEmbed,
  pendingSoundCloudIds,
  resolveSoundCloudSlots,
  soundCloudApiTrack,
  type ImportedTrackRef,
  type PlaylistLink,
  type PlaylistProvider,
} from "./playlistLinks";
import { pickBestMatch, searchQueries } from "./playlistMatch";

/*
 * Importing a Spotify, SoundCloud or Apple Music playlist from its link.
 *
 * Three steps: read the public page behind the link into "title by artist" rows, find each row
 * on YouTube Music, and put what was found into a new playlist. The middle step is a guess by
 * nature — another service's song has no YouTube id — so what could not be found is reported
 * back instead of being dropped, and nothing is created when nothing was found.
 */

const BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

const FALLBACK_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0";

const PROVIDER_NAMES: Record<PlaylistProvider, string> = {
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  apple: "Apple Music",
};

/** How many searches run at once. Enough to be quick, few enough not to look like a flood. */
const SEARCH_CONCURRENCY = 3;
/** SoundCloud's track lookup takes at most this many ids per request. */
const SOUNDCLOUD_BATCH = 50;
/** Script bundles read while looking for SoundCloud's client id, newest first. */
const SOUNDCLOUD_SCRIPTS_TO_TRY = 5;

export interface FetchedPlaylist {
  provider: PlaylistProvider;
  title: string;
  tracks: ImportedTrackRef[];
  /** Set when the service handed back only part of the playlist. Shown to the person as-is. */
  warning?: string;
}

async function fetchPage(
  url: string,
  headers: Record<string, string> = BROWSER_HEADERS,
): Promise<{ status: number; body: string }> {
  try {
    const response = await tauriFetch(url, { headers, timeoutMs: 20_000 });
    return { status: response.status, body: await response.text() };
  } catch (error) {
    logInternalWarn("playlistLinkImport.fetch failed", {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new PlaylistLinkError("network", "Could not reach the site. Check your connection and try again.");
  }
}

function failForStatus(provider: PlaylistProvider, status: number): never {
  const name = PROVIDER_NAMES[provider];
  if (status === 404 || status === 410) {
    throw new PlaylistLinkError("not-found", `${name} could not find that playlist. Check the link.`);
  }
  if (status === 401 || status === 403) {
    throw new PlaylistLinkError(
      "private",
      `${name} would not show that playlist. If it is private, make it public and try again.`,
    );
  }
  if (status === 429) {
    throw new PlaylistLinkError("blocked", `${name} is limiting requests. Wait a minute and try again.`);
  }
  throw new PlaylistLinkError("unreadable", `${name} answered with an error (${status}).`);
}

async function fetchSpotify(link: PlaylistLink): Promise<FetchedPlaylist> {
  const url = `https://open.spotify.com/embed/playlist/${link.id}`;
  let page = await fetchPage(url);
  // Spotify sometimes refuses one browser fingerprint and accepts another.
  if (page.status === 403 || page.status === 429) {
    await new Promise((resolve) => globalThis.setTimeout(resolve, 800));
    page = await fetchPage(url, { ...BROWSER_HEADERS, "user-agent": FALLBACK_USER_AGENT });
  }
  if (page.status !== 200) failForStatus("spotify", page.status);

  const parsed = parseSpotifyEmbed(page.body);
  let warning: string | undefined;
  const reportedTotal = parsed.total;
  if (reportedTotal !== undefined && reportedTotal > parsed.tracks.length) {
    warning = `Spotify only shares ${parsed.tracks.length} of this playlist's ${reportedTotal} songs through a link.`;
  } else if (parsed.tracks.length >= SPOTIFY_EMBED_LIMIT) {
    // The page caps its list, and does not always say what it left out.
    warning = `Spotify only shares the first ${SPOTIFY_EMBED_LIMIT} songs of a playlist through a link, so a longer one may be cut short.`;
  }
  return { provider: "spotify", title: parsed.title, tracks: parsed.tracks, warning };
}

async function fetchApple(link: PlaylistLink): Promise<FetchedPlaylist> {
  const page = await fetchPage(link.url);
  if (page.status !== 200) failForStatus("apple", page.status);
  const parsed = parseAppleMusicPage(page.body);
  return { provider: "apple", title: parsed.title, tracks: parsed.tracks };
}

/**
 * SoundCloud's page names only the first few songs of a set; the rest are bare ids. Asking for
 * them needs the public client id its own site uses, which sits in one of its script bundles.
 * That is an undocumented lookup, so every step of it is allowed to fail — the songs already
 * read are still imported, and the person is told how many were left behind.
 */
async function resolveSoundCloudIds(
  pageHtml: string,
  ids: string[],
): Promise<Map<string, ImportedTrackRef>> {
  const resolved = new Map<string, ImportedTrackRef>();
  if (!ids.length) return resolved;

  const scripts = findSoundCloudScripts(pageHtml).reverse().slice(0, SOUNDCLOUD_SCRIPTS_TO_TRY);
  let clientId: string | null = null;
  for (const script of scripts) {
    try {
      const { status, body } = await fetchPage(script, { ...BROWSER_HEADERS, accept: "*/*" });
      if (status !== 200) continue;
      clientId = extractSoundCloudClientId(body);
      if (clientId) break;
    } catch {
      // Try the next bundle.
    }
  }
  if (!clientId) {
    logInternalWarn("playlistLinkImport.soundcloud no client id", { scripts: scripts.length });
    return resolved;
  }

  for (let start = 0; start < ids.length; start += SOUNDCLOUD_BATCH) {
    const batch = ids.slice(start, start + SOUNDCLOUD_BATCH);
    try {
      const { status, body } = await fetchPage(
        `https://api-v2.soundcloud.com/tracks?ids=${batch.join(",")}&client_id=${clientId}`,
        { ...BROWSER_HEADERS, accept: "application/json" },
      );
      if (status !== 200) continue;
      const rows: unknown = JSON.parse(body);
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const track = soundCloudApiTrack(row);
        if (track) resolved.set(track.id, track.track);
      }
    } catch (error) {
      logInternalWarn("playlistLinkImport.soundcloud batch failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return resolved;
}

async function fetchSoundCloud(link: PlaylistLink): Promise<FetchedPlaylist> {
  const page = await fetchPage(link.url);
  if (page.status !== 200) failForStatus("soundcloud", page.status);

  const parsed = parseSoundCloudPage(page.body);
  const fetched = await resolveSoundCloudIds(page.body, pendingSoundCloudIds(parsed));
  const { tracks, unresolved } = resolveSoundCloudSlots(parsed, fetched);
  if (!tracks.length) {
    throw new PlaylistLinkError("unreadable", "SoundCloud did not list any songs for that playlist.");
  }
  return {
    provider: "soundcloud",
    title: parsed.title,
    tracks,
    warning: unresolved
      ? `${unresolved} ${unresolved === 1 ? "song" : "songs"} could not be loaded from SoundCloud and ${unresolved === 1 ? "was" : "were"} left out.`
      : undefined,
  };
}

/** Reads the playlist behind a recognised link. */
export async function fetchPlaylistFromLink(link: PlaylistLink): Promise<FetchedPlaylist> {
  switch (link.provider) {
    case "spotify":
      return fetchSpotify(link);
    case "apple":
      return fetchApple(link);
    case "soundcloud":
      return fetchSoundCloud(link);
  }
}

export interface MatchResult {
  /** One per input song that was found, in playlist order, without repeats. */
  tracks: Track[];
  missing: ImportedTrackRef[];
}

/** Finds each song on YouTube Music. Songs that no search result resembles are reported, not guessed. */
export async function matchOnYouTube(
  refs: readonly ImportedTrackRef[],
  onProgress?: (done: number, total: number) => void,
): Promise<MatchResult> {
  const found: Array<Track | null> = new Array(refs.length).fill(null);
  let searchFailures = 0;
  let done = 0;
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < refs.length) {
      const index = next;
      next += 1;
      const ref = refs[index];
      let failedEvery = true;

      for (const query of searchQueries(ref)) {
        try {
          const results = await searchController.searchTracks(query);
          failedEvery = false;
          const best = pickBestMatch(ref, results);
          if (best) {
            found[index] = best.match;
            break;
          }
        } catch (error) {
          logInternalWarn("playlistLinkImport.search failed", {
            query,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (failedEvery) searchFailures += 1;
      done += 1;
      onProgress?.(done, refs.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(SEARCH_CONCURRENCY, refs.length) }, worker));

  // Every single search erroring means the problem is the connection or the account, not that
  // none of the songs exist — and "nothing was found" would be the wrong thing to tell them.
  if (refs.length > 0 && searchFailures === refs.length) {
    throw new PlaylistLinkError("network", "Could not search YouTube Music. Check your connection and try again.");
  }

  const tracks: Track[] = [];
  const missing: ImportedTrackRef[] = [];
  const seen = new Set<string>();
  found.forEach((track, index) => {
    if (!track) {
      missing.push(refs[index]);
    } else if (!seen.has(track.id)) {
      seen.add(track.id);
      tracks.push(track);
    }
  });
  return { tracks, missing };
}

export type LinkImportStatus =
  | { phase: "reading" }
  | { phase: "matching"; done: number; total: number }
  | { phase: "saving"; done: number; total: number };

export interface LinkImportResult {
  playlist: Playlist;
  provider: PlaylistProvider;
  /** Songs the other service listed. */
  requested: number;
  /** Songs put into the playlist. */
  added: number;
  missing: ImportedTrackRef[];
  /** Songs that matched but could not be added to the playlist. */
  failed: number;
  warning?: string;
}

/** Reads a playlist link, finds its songs on YouTube Music and saves them as a new playlist. */
export async function importPlaylistFromLink(
  link: PlaylistLink,
  options: { local: boolean; onStatus?: (status: LinkImportStatus) => void },
): Promise<LinkImportResult> {
  const { local, onStatus } = options;

  onStatus?.({ phase: "reading" });
  const fetched = await fetchPlaylistFromLink(link);
  logInternalInfo("playlistLinkImport.fetched", {
    provider: fetched.provider,
    songs: fetched.tracks.length,
    warned: Boolean(fetched.warning),
  });

  onStatus?.({ phase: "matching", done: 0, total: fetched.tracks.length });
  const matched = await matchOnYouTube(fetched.tracks, (done, total) =>
    onStatus?.({ phase: "matching", done, total }),
  );

  // Before anything is created: an empty playlist is a thing to go and delete.
  if (!matched.tracks.length) {
    throw new PlaylistLinkError(
      "not-found",
      "None of those songs could be found on YouTube Music, so no playlist was made.",
    );
  }

  const playlist = await libraryController.createPlaylist(fetched.title, { local });
  onStatus?.({ phase: "saving", done: 0, total: matched.tracks.length });
  const saved = await libraryController.addTracksToPlaylist(matched.tracks, playlist, (done, total) =>
    onStatus?.({ phase: "saving", done, total }),
  );

  logInternalInfo("playlistLinkImport.done", {
    provider: fetched.provider,
    requested: fetched.tracks.length,
    matched: matched.tracks.length,
    missing: matched.missing.length,
    added: saved.added,
    failed: saved.failed,
  });

  return {
    playlist,
    provider: fetched.provider,
    requested: fetched.tracks.length,
    added: saved.added + saved.alreadyPresent,
    missing: matched.missing,
    failed: saved.failed,
    warning: fetched.warning,
  };
}
