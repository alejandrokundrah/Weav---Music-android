/**
 * Self-check for playlist link import: link recognition, the three page parsers, and song
 * matching. Run with `npm run check`.
 *
 * The page fixtures below are hand-written in the shape each service embeds its data in. They
 * are what keeps a parser honest, and also what will go stale: if a service reshapes its page,
 * the parser breaks in production while these keep passing. When that happens, replace the
 * fixture with the new real shape first, watch the check fail, then fix the parser.
 */
export {};

import {
  PlaylistLinkError,
  describeUnsupportedLink,
  detectPlaylistLink,
  extractSoundCloudClientId,
  findSoundCloudScripts,
  parseAppleMusicPage,
  parseIsoDuration,
  parseSoundCloudPage,
  parseSpotifyEmbed,
  pendingSoundCloudIds,
  resolveSoundCloudSlots,
  soundCloudApiTrack,
} from "./playlistLinks";
import { MATCH_THRESHOLD, pickBestMatch, scoreMatch, searchQueries, titleTokens } from "./playlistMatch";

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAILED: ${message}`);
}

function equal(actual: unknown, expected: unknown, message: string): void {
  check(actual === expected, `${message}: expected ${String(expected)}, got ${String(actual)}`);
}

function throwsWith(code: string, run: () => unknown, message: string): void {
  try {
    run();
  } catch (error) {
    check(error instanceof PlaylistLinkError && error.code === code, `${message}: wrong error ${String(error)}`);
    return;
  }
  throw new Error(`FAILED: ${message}: did not throw`);
}

// --- Recognising links ----------------------------------------------------------------------
const reported =
  "https://open.spotify.com/playlist/0npcEgPkiLBXMTOklZCRVV?si=1SDWkrFcSuqmLIw-VjaFZg&utm_source=copy-link&pi=vyEkLdYYSnGCF";
const spotify = detectPlaylistLink(reported);
equal(spotify?.provider, "spotify", "the link that was reported as failing is recognised");
equal(spotify?.id, "0npcEgPkiLBXMTOklZCRVV", "its id is the 22 characters, not the tracking parameters");
equal(spotify?.url, "https://open.spotify.com/playlist/0npcEgPkiLBXMTOklZCRVV", "the fetched URL is clean");

equal(
  detectPlaylistLink("https://open.spotify.com/intl-de/playlist/0npcEgPkiLBXMTOklZCRVV")?.id,
  "0npcEgPkiLBXMTOklZCRVV",
  "a locale-prefixed Spotify link is the same playlist",
);
equal(
  detectPlaylistLink("https://open.spotify.com/embed/playlist/0npcEgPkiLBXMTOklZCRVV")?.id,
  "0npcEgPkiLBXMTOklZCRVV",
  "an embed link is the same playlist",
);
equal(
  detectPlaylistLink("spotify:playlist:0npcEgPkiLBXMTOklZCRVV")?.provider,
  "spotify",
  "a Spotify URI is accepted",
);
equal(
  detectPlaylistLink("  open.spotify.com/playlist/0npcEgPkiLBXMTOklZCRVV  ")?.provider,
  "spotify",
  "a link pasted without a scheme, with spaces around it, is accepted",
);
equal(detectPlaylistLink("https://open.spotify.com/album/0npcEgPkiLBXMTOklZCRVV"), null, "an album is not a playlist");
equal(detectPlaylistLink("https://open.spotify.com/playlist/short"), null, "a malformed id is rejected");

const apple = detectPlaylistLink(
  "https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb?l=en",
);
equal(apple?.provider, "apple", "an Apple Music playlist is recognised");
equal(apple?.id, "pl.f4d106fed2bd41149aaacabb233eb5eb", "its id is the pl.… segment");
equal(
  apple?.url,
  "https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb",
  "the query string is dropped",
);
equal(
  detectPlaylistLink("https://music.apple.com/gb/playlist/pl.u-8aAVXpRTWGe5Wn")?.url,
  "https://music.apple.com/gb/playlist/playlist/pl.u-8aAVXpRTWGe5Wn",
  "a user playlist with no slug gets one, and keeps its storefront",
);
equal(detectPlaylistLink("https://music.apple.com/us/album/x/12345"), null, "an Apple album is not a playlist");

const soundcloud = detectPlaylistLink("https://soundcloud.com/some-user/sets/late-night?utm_source=clipboard");
equal(soundcloud?.provider, "soundcloud", "a SoundCloud set is recognised");
equal(soundcloud?.url, "https://soundcloud.com/some-user/sets/late-night", "tracking parameters are dropped");
equal(
  detectPlaylistLink("https://soundcloud.com/some-user/sets/late-night/s-AbC123")?.url,
  "https://soundcloud.com/some-user/sets/late-night/s-AbC123",
  "a private link keeps its secret token, which is what makes it readable",
);
equal(detectPlaylistLink("https://soundcloud.com/some-user/some-track"), null, "a SoundCloud track is not a set");
equal(detectPlaylistLink("https://example.com/playlist/1"), null, "another site is rejected");
equal(detectPlaylistLink("not a link"), null, "plain text is rejected");

check(
  describeUnsupportedLink("https://on.soundcloud.com/abc").includes("shortened"),
  "a short link is named as one, since the fix is different",
);
check(
  describeUnsupportedLink("https://open.spotify.com/album/0npcEgPkiLBXMTOklZCRVV").includes("not a playlist"),
  "an album link says it is not a playlist",
);

// --- Spotify page ---------------------------------------------------------------------------
function spotifyPage(entity: unknown, extra: Record<string, unknown> = {}): string {
  const data = { props: { pageProps: { state: { data: { entity } }, ...extra } } };
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></body></html>`;
}

const spotifyPlaylist = parseSpotifyEmbed(
  spotifyPage({
    name: "Road trip",
    totalCount: 3,
    trackList: [
      { uri: "spotify:track:1", title: "Blinding Lights", subtitle: "The Weeknd", duration: 200040 },
      { uri: "spotify:track:2", title: "Levitating", subtitle: "Dua Lipa, DaBaby", duration: 203064 },
      { uri: "spotify:track:3", title: "No duration", subtitle: "Someone" },
    ],
  }),
);
equal(spotifyPlaylist.title, "Road trip", "the playlist's name is read");
equal(spotifyPlaylist.tracks.length, 3, "every listed song is read");
equal(spotifyPlaylist.tracks[0].durationSec, 200, "milliseconds become seconds");
equal(spotifyPlaylist.tracks[1].artist, "Dua Lipa, DaBaby", "no-break spaces in artist names are normalised");
equal(spotifyPlaylist.tracks[2].durationSec, undefined, "a missing duration stays missing");
equal(spotifyPlaylist.total, 3, "the reported total is carried, so a short list can be flagged");

const walked = parseSpotifyEmbed(
  spotifyPage({
    name: "Moved shape",
    sections: [{ items: [{ uri: "spotify:track:9", title: "Found anyway", subtitle: "Artist" }] }],
  }),
);
equal(walked.tracks[0]?.title, "Found anyway", "songs are still found when the named path has moved");

throwsWith("not-found", () => parseSpotifyEmbed(spotifyPage({}, { status: 404 })), "a 404 page");
throwsWith("unreadable", () => parseSpotifyEmbed("<html>nothing here</html>"), "a page with no data");
throwsWith("private", () => parseSpotifyEmbed("<html>This playlist is private</html>"), "a private page");
throwsWith("unreadable", () => parseSpotifyEmbed(spotifyPage({ name: "Empty", trackList: [] })), "an empty playlist");

// --- Apple Music page -----------------------------------------------------------------------
equal(parseIsoDuration("PT3M20S"), 200, "an ISO duration is read");
equal(parseIsoDuration("PT1H2M3S"), 3723, "hours are read");
equal(parseIsoDuration("nonsense"), undefined, "garbage is not a duration");

const appleLd = {
  "@context": "http://schema.org",
  "@type": "MusicPlaylist",
  name: "Today's Hits",
  track: [
    { "@type": "MusicRecording", name: "Espresso", duration: "PT2M55S", byArtist: [{ name: "Sabrina Carpenter" }] },
    { "@type": "MusicRecording", name: "Birds of a Feather", duration: "PT3M30S", byArtist: { name: "Billie Eilish" } },
  ],
};
const appleFromLd = parseAppleMusicPage(
  `<script type="application/ld+json">${JSON.stringify(appleLd)}</script>`,
);
equal(appleFromLd.title, "Today's Hits", "the Apple playlist name is read");
equal(appleFromLd.tracks.length, 2, "both songs are read from the structured data");
equal(appleFromLd.tracks[0].artist, "Sabrina Carpenter", "an artist list is flattened");
equal(appleFromLd.tracks[1].artist, "Billie Eilish", "a single artist object is read too");
equal(appleFromLd.tracks[0].durationSec, 175, "the ISO duration becomes seconds");

const appleServer = {
  data: [
    {
      sections: [
        {
          items: [
            { title: "Espresso", artistName: "Sabrina Carpenter", duration: 175000 },
            { title: "Birds of a Feather", artistName: "Billie Eilish", duration: 210000 },
            { title: "Third song", artistName: "Third Artist", duration: 180000 },
            // An album tile: has an artistName but no duration, so it must not be read as a song.
            { title: "Some Album", artistName: "Album Artist" },
          ],
        },
      ],
    },
  ],
};
const appleBoth = parseAppleMusicPage(
  `<script type="application/ld+json">${JSON.stringify({ ...appleLd, track: appleLd.track })}</script>`
    + `<script type="application/json" id="serialized-server-data">${JSON.stringify(appleServer)}</script>`,
);
equal(appleBoth.tracks.length, 3, "the source with more songs wins, since the other was truncated");
check(!appleBoth.tracks.some((track) => track.title === "Some Album"), "an album tile is not read as a song");

throwsWith("unreadable", () => parseAppleMusicPage("<html></html>"), "an Apple page with no data");

// --- SoundCloud page ------------------------------------------------------------------------
const hydration = [
  { hydratable: "anonymousId", data: "x" },
  {
    hydratable: "playlist",
    data: {
      title: "Late night",
      tracks: [
        {
          id: 1,
          title: "First",
          full_duration: 181000,
          user: { username: "uploader-one" },
          publisher_metadata: { artist: "Real Artist" },
        },
        { id: 2, kind: "track" },
        { id: 3, title: "Third", duration: 120000, user: { username: "uploader-three" } },
        { id: 4, kind: "track" },
      ],
    },
  },
];
const scPage = parseSoundCloudPage(
  `<script>window.__sc_hydration = ${JSON.stringify(hydration)};</script>`,
);
equal(scPage.title, "Late night", "the SoundCloud set name is read");
equal(scPage.slots.length, 4, "every slot is kept, including the ones named only by id");
equal(pendingSoundCloudIds(scPage).join(","), "2,4", "the songs that need a follow-up request are listed in order");

const fetched = new Map([
  ["2", { title: "Second", artist: "Two", durationSec: 90 }],
]);
const resolved = resolveSoundCloudSlots(scPage, fetched);
equal(resolved.tracks.map((track) => track.title).join(","), "First,Second,Third", "order is preserved when slots fill");
equal(resolved.unresolved, 1, "a song that could not be resolved is counted, not hidden");
equal(resolved.tracks[0].artist, "Real Artist", "the credited artist beats the uploader's name");
equal(resolved.tracks[2].artist, "uploader-three", "the uploader is used when no artist is credited");
equal(resolved.tracks[0].durationSec, 181, "full_duration is preferred");

const apiTrack = soundCloudApiTrack({ id: 7, title: "Seven", duration: 60000, user: { username: "u" } });
equal(apiTrack?.id, "7", "an API track keeps its id as a string");
equal(soundCloudApiTrack({ id: 8 }), null, "an API row with no title is skipped");

throwsWith("unreadable", () => parseSoundCloudPage("<html></html>"), "a SoundCloud page with no data");
throwsWith(
  "unreadable",
  () => parseSoundCloudPage(`<script>window.__sc_hydration = ${JSON.stringify([{ hydratable: "user", data: {} }])};</script>`),
  "a SoundCloud page that is not a set",
);

equal(
  extractSoundCloudClientId('...,client_id:"AbCdEfGhIjKlMnOpQrStUvWxYz012345",...'),
  "AbCdEfGhIjKlMnOpQrStUvWxYz012345",
  "the client id is found in a bundle",
);
equal(extractSoundCloudClientId("no id here"), null, "a bundle without one reports none");
equal(
  findSoundCloudScripts('<script src="https://a-v2.sndcdn.com/assets/0-abc.js"></script><script src="https://evil.example/x.js"></script>').length,
  1,
  "only SoundCloud's own bundles are read for the id",
);

// --- Matching -------------------------------------------------------------------------------
equal(titleTokens("Song (feat. Someone)").join(" "), "song", "a featuring credit is not part of the title");
equal(titleTokens("Song - 2011 Remaster").join(" "), "song", "a remaster note is not part of the title");
equal(titleTokens("Beyoncé").join(" "), "beyonce", "accents are folded");

const wanted = { title: "Blinding Lights", artist: "The Weeknd", durationSec: 200 };
const candidates = [
  { title: "Blinding Lights (Karaoke Version)", artist: "Karaoke Hits", durationSec: 200 },
  { title: "Blinding Lights", artist: "The Weeknd", durationSec: 202 },
  { title: "Blinding Lights - Live", artist: "The Weeknd", durationSec: 260 },
];
equal(pickBestMatch(wanted, candidates)?.match, candidates[1], "the original beats a karaoke cut and a live one");
check(scoreMatch(wanted, candidates[1]) > scoreMatch(wanted, candidates[0]), "the original scores above the karaoke cut");

equal(
  pickBestMatch(wanted, [{ title: "Starboy", artist: "The Weeknd", durationSec: 230 }]),
  null,
  "a different song by the same artist is not accepted",
);
equal(pickBestMatch(wanted, []), null, "no results is no match");

check(
  scoreMatch(
    { title: "Levitating", artist: "Dua Lipa, DaBaby" },
    { title: "Levitating (feat. DaBaby)", artist: "Dua Lipa", artists: [{ name: "DaBaby" }] },
  ) >= MATCH_THRESHOLD,
  "a credit written differently on each service still matches",
);
check(
  scoreMatch(
    { title: "Mad World", artist: "Gary Jules" },
    { title: "Mad World", artist: "Gary Jules", durationSec: 190 },
  ) >= MATCH_THRESHOLD,
  "a missing duration on one side does not stop a match",
);
check(
  scoreMatch({ title: "Song", artist: "A", durationSec: 200 }, { title: "Song", artist: "A", durationSec: 400 })
    < scoreMatch({ title: "Song", artist: "A", durationSec: 200 }, { title: "Song", artist: "A", durationSec: 201 }),
  "a wildly different length counts against a match",
);
check(
  scoreMatch({ title: "Song (Live)", artist: "A" }, { title: "Song (Live)", artist: "A" }) >= MATCH_THRESHOLD,
  "a live song is matched to the live version when that is what was asked for",
);

equal(searchQueries({ title: "Song", artist: "A & B" }).join("|"), "A Song|Song", "the first artist leads the query");
equal(searchQueries({ title: "Song", artist: "" }).join("|"), "Song", "a song with no artist is searched by title alone");

console.log("playlistLinks.check: all assertions passed");
