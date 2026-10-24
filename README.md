<p align="center">
  <img width="120px" src="Weav logo.svg" alt="WEAV" />
</p>

<h1 align="center">WEAV</h1>

<p align="center">
  <b>Music for every moment.</b><br />
  A fast, beautiful YouTube Music client for <b>Windows, macOS, Linux and Android</b> —<br />
  smooth to use, and free of constant ad interruptions.
</p>

<p align="center">
  <a href="#download">Download</a> ·
  <a href="#features">Features</a> ·
  <a href="#troubleshooting">Troubleshooting</a> ·
  <a href="#build-from-source">Build from source</a> ·
  <a href="#contributing">Contributing</a>
</p>

> [!IMPORTANT]
> WEAV is an independent, unofficial project. It is not affiliated with, authorized by,
> sponsored by, or endorsed by YouTube or Google.

<br />

## About

WEAV brings YouTube Music to your desktop and phone as a fast, native-feeling app. Stream,
download and connect through music — your whole library in one place, with synced lyrics, an
offline mode, tabs that each keep their own queue, and a layout built for the screen you are on.

It is built with [Tauri](https://tauri.app) (Rust), React and TypeScript.

### About the developer

Hey there! I'm Alejandro Kundrah, an independent developer. I built this app because I believe
listening to music should be smooth, beautiful, and free of constant ad interruptions. Hope you
enjoy using it as much as I enjoyed building it!

<br />

## Features

### Listening

| | |
|---|---|
| **Synced lyrics** | Line-by-line lyrics that follow the song. Click a line to jump to it, nudge the timing if a match is off, and pick which source is tried first |
| **Lyrics translation** | A translation under each line, in any of twenty languages, with an adjustable text size |
| **Queue control** | Collapses to an artwork-only rail; end the queue at a track, generate more from it, shuffle or clear what's next |
| **Multiple tabs** | Each tab keeps its own queue, volume and player state — start an album in one, browse in another, and the first keeps playing |
| **Mini player** | A morphing capsule that appears when you tab away; drag it anywhere, hover to expand |

### Your library

| | |
|---|---|
| **Account support** | Sign in with Google for your library and playlists, and switch between accounts and channels |
| **Like & dislike** | Rate from the row, the player or the right-click menu — ratings sync to your YouTube Music account |
| **Offline downloads** | Save a song, a selection, or a whole album or playlist, with its own quality setting and a size cap you control |
| **Local files** | Folders from your own machine sit alongside your library, with a tag editor for fixing metadata |
| **Playlist import/export** | Save a playlist to a file and bring it back, on this machine or another |
| **Batch actions** | Shift/ctrl-select rows, then queue, download, add to a playlist or remove them together |

### Discovery

| | |
|---|---|
| **Search** | Ctrl+Space from anywhere, across artists, songs, playlists and albums |
| **Recommendations** | Personalised suggestions plus a "surprise me" shuffle — hide the carousel if you would rather open on your library |
| **Browse** | Explore, charts, moods and genres, and podcasts, with mood chips you can drill into |

### The app itself

| | |
|---|---|
| **Phone layout** | A dedicated touch interface for Android phones, separate from the desktop one |
| **Desktop integration** | Media keys, minimise to tray, launch at login, remembered window position, rebindable shortcuts |
| **Discord & Last.fm** | Rich Presence and scrobbling, each toggleable straight from the toolbar |
| **Light & dark themes** | Follows the OS by default, or pin either one — plus a reduced-motion mode |
| **Languages** | English, Spanish and French |
| **Caching** | Playlists, lyrics and artwork are cached, so revisits are instant |
| **Auto-updates** | Signed updates install themselves on desktop; no manual re-download |

<br />

## Download

### Desktop

Grab the newest installer for Windows, macOS or Linux.

On Arch and derivatives, install from the AUR instead:

```bash
yay -S weav     # or: paru -S weav
```

### Android

Requires **Android 8.0 (API 26) or newer**. The APK is built by the repository's **Android**
workflow:

1. Open the repository's **Actions** tab and choose **Android → Run workflow**.
2. Pick a variant:
   - **phone** — arm64, with the phone layout.
   - **tv** — arm64 and 32-bit armv7 in one APK, always the desktop layout, declared for Android TV.
     The armv7 part matters: many TVs are 32-bit only and refuse an arm64-only APK as "not compatible".
3. When the run finishes, download the APK from its **Artifacts** section and install it.

> [!NOTE]
> An unsigned APK cannot be installed. If the repository has its signing secrets set
> (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`) the APK is signed
> with that key. Without them a throwaway key is used, which is fine for trying the app out but
> means a later build will not install over it. Use the same key every time to keep updating in place.

<br />

## Platform support

| Platform | Status |
|---|---|
| **Windows** | Primary target; the most tested of the four |
| **macOS** | Supported. The build is unsigned — see [macOS notes](#macos) |
| **Linux** | Supported across major distros; runs on your system's WebKitGTK and GStreamer |
| **Android** | Phone and Android TV builds (Android 8.0+) |

<br />

## Troubleshooting

### Linux

Install the `.deb` or `.rpm`, or `weav` from the AUR on Arch. All three run on your system's
WebKitGTK (rendering) and GStreamer (playback) rather than bundling their own.

<details>
<summary>🔇 No sound, or "YouTube player error 5"</summary>

Most distros don't install the codecs YouTube needs by default:

```bash
# Debian, Ubuntu, Mint
sudo apt install gstreamer1.0-libav gstreamer1.0-plugins-base gstreamer1.0-plugins-good

# Fedora (gstreamer1-libav needs RPM Fusion enabled)
sudo dnf install gstreamer1-libav gstreamer1-plugins-base gstreamer1-plugins-good

# Arch — installed automatically with the AUR package
sudo pacman -S gst-libav gst-plugins-base gst-plugins-good
```

Confirm they registered:

```bash
gst-inspect-1.0 | grep -E 'avdec_aac|avdec_h264'
```

</details>

<details>
<summary>⬜ A blank grey window</summary>

A WebKitGTK rendering problem under Wayland, most often on Nvidia. Launch from a terminal with
one of:

```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1 weav
WEBKIT_DISABLE_COMPOSITING_MODE=1 weav
GDK_BACKEND=x11 weav
```

Launching from an app menu instead? Add the same variable to the `Exec` line of `weav.desktop`
(typically `/usr/share/applications/weav.desktop`, or `~/.local/share/applications/weav.desktop`
for a user install):

```
Exec=env WEBKIT_DISABLE_DMABUF_RENDERER=1 weav
```

</details>

<details>
<summary>⚠️ An EGL error on launch</summary>

Preload the system Wayland client library:

```bash
LD_PRELOAD=/usr/lib/libwayland-client.so ~/Downloads/weav*.AppImage
```

In Gear Lever, add `LD_PRELOAD=/usr/lib/libwayland-client.so` to WEAV's environment variables.

</details>

### macOS

<details>
<summary>🍎 "Apple is not able to verify that it is free from malware"</summary>

The macOS builds aren't signed with an Apple Developer ID, so Gatekeeper blocks them on first
launch. This isn't a malware finding — it means the binary is unsigned. Drag WEAV to
Applications, then either:

- open **System Settings → Privacy & Security**, scroll to the message about WEAV, and click
  **Open Anyway**, or
- clear the quarantine flag yourself:

```bash
xattr -dr com.apple.quarantine /Applications/WEAV.app
```

Build from source instead if you'd rather not trust a prebuilt, unsigned binary.

</details>

<details>
<summary>🔑 A Keychain prompt on sign-in</summary>

WEAV stores one encryption key in its own Keychain entry and encrypts your YouTube Music
session with it before writing anything to the app data directory. Choose **Always Allow** to
avoid repeated prompts — or **Deny** if you don't intend to sign in to YouTube Music.

</details>

### Anything else

Open **Settings → Library → Application log**, reproduce the problem, and attach the log to an
[issue](../../issues/new/choose) along with your desktop environment, display server (X11 or
Wayland) and distro — those three narrow down a Linux bug faster than anything else. The log also
lives at `~/.local/share/com.weav.desktop/logs/current.log` on Linux.

<br />

## Build from source

### Prerequisites

- Node.js LTS and npm
- [Rust and Cargo](https://rustup.rs/)
- C++ build tools (MSVC on Windows)
- Microsoft Edge WebView2 Runtime (Windows)

The Tauri CLI ships in the project's dev dependencies — no global install needed.

### Install, run, build

```bash
npm install
npm run tauri dev       # run the desktop app with hot reload
npm run tauri build     # produce an installer
```

Before opening a pull request, run the type check and the self-checks:

```bash
npm run verify
```

Android APKs are built by the [Android workflow](.github/workflows/android.yml), which generates
the Android project with `tauri android init` rather than keeping a generated Gradle tree in the
repository.

### Project docs


<br />

## Contributing

Contributions are welcome. Fork the repo, branch, test locally, and open a pull request
describing what changed and why. For larger changes, open an issue first so the approach can be
discussed.

By contributing you agree to the [Contributor License Agreement](CLA.md).

<br />

## Credits

WEAV is a fork of [JustAnotherMusicClient](https://github.com/2latemc/JustAnotherMusicClient) by 2latemc (Apache-2.0), developed and maintained by Alejandro Kundrah.

## License

Released under the [Apache License 2.0](LICENSE).

## Legal

WEAV does not host or claim ownership of music, videos, artwork, metadata, or any other content
supplied by third parties. Rights in that content remain with their respective owners.

The project is not intended to circumvent access controls, geographic restrictions, advertising,
paid service requirements, or content licensing, nor to enable unauthorised downloading, copying,
redistribution or public performance of third-party content.

YouTube and YouTube Music are trademarks of Google LLC. All other trademarks are the property of
their respective owners. References to third-party products describe compatibility and
integration only.

- [YouTube Terms of Service](https://www.youtube.com/static?template=terms)
- [YouTube API Services Terms of Service](https://developers.google.com/youtube/terms/api-services-terms-of-service)
- [YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies)
