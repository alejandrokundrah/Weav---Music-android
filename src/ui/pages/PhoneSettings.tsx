import { useState } from "react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/motion/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import {
  DownloadIcon,
  LastFmIcon,
  LogoutIcon,
  LyricsIcon,
  PaletteIcon,
  PlayIcon,
  RefreshIcon,
  UserIcon,
} from "@/ui/icons";
import type { AccountProfile } from "../../datasource/types";
import type { LibraryState } from "../../player/LibraryController";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { LYRICS_SOURCES } from "../../datasource/youtube/lyricsSources";
import { AUTO_LYRICS_SOURCE } from "../../internal/lyricsSourcePreference";
import {
  AUDIO_QUALITY_LABELS,
  type AudioQuality,
} from "../../internal/audioQuality";
import {
  AUDIO_ENGINE_MODES,
  type AudioEngineMode,
} from "../settings/audioEngine";
import type { ThemePreference } from "../settings/theme";
import type { UpdateInfo, UpdateInstallProgress } from "../../internal/updateChecker";
import { LYRICS_FONT_SCALES } from "../settings/lyricsFontScale";
import {
  TRANSLATION_LANGUAGES,
  TRANSLATION_OFF,
  getLanguageLabel,
} from "../settings/lyricsTranslation";

export interface PhoneSettingsProps {
  libraryState: LibraryState;
  account: AccountProfile | null;
  isSignedIn: boolean;
  onSignIn: () => Promise<void> | void;
  onSignOut: () => Promise<void> | void;

  /* Theme & Appearance */
  themePreference?: ThemePreference;
  onThemeChange?: (theme: ThemePreference) => void;
  potatoPcMode: boolean;
  onPotatoPcChange: (enabled: boolean) => void;
  madeForYouVisible: boolean;
  onMadeForYouChange: (enabled: boolean) => void;

  /* Audio & Streaming */
  streamingQuality: AudioQuality;
  onStreamingQualityChange: (quality: AudioQuality) => void;
  downloadQuality: AudioQuality;
  onDownloadQualityChange: (quality: AudioQuality) => void;
  audioEngineMode: AudioEngineMode;
  onAudioEngineModeChange: (mode: AudioEngineMode) => void;
  authenticatedStreaming: boolean;
  onAuthenticatedStreamingChange: (enabled: boolean) => void;
  youtubeScrobbling: boolean;
  onYouTubeScrobblingChange: (enabled: boolean) => void;

  /* Playback */
  gaplessEnabled: boolean;
  onGaplessChange: (enabled: boolean) => void;
  crossfadeSec: number;
  onCrossfadeChange: (sec: number) => void;
  sessionRestoreEnabled: boolean;
  onSessionRestoreChange: (enabled: boolean) => void;

  /* Lyrics */
  preferredLyricsSource: string;
  onPreferredLyricsSourceChange: (sourceId: string) => void;
  lyricsFontScale: number;
  onLyricsFontScaleChange: (scale: number) => void;
  lyricsTranslationLang: string;
  onLyricsTranslationLangChange: (lang: string) => void;

  /* Storage & Cache */
  cacheBytes: number;
  onClearCache: () => Promise<void>;
  offlineBytes: number;
  offlineCount: number;
  offlineMaxGb: number;
  onOfflineMaxGbChange: (gb: number) => void;
  onRemoveAllDownloads: () => Promise<void>;

  /* Last.fm */
  lastFmSession: { username: string } | null;
  lastFmScrobblingEnabled: boolean;
  onLastFmScrobblingChange: (enabled: boolean) => void;
  onConnectLastFm: () => void;
  onDisconnectLastFm: () => void;

  /* Maintenance */
  installedVersion: string;
  updateInfo: UpdateInfo | null;
  isCheckingUpdate: boolean;
  onCheckForUpdates: () => void;
  onInstallUpdate: () => void;
  updateProgress: UpdateInstallProgress | null;
  onRestartOnboarding: () => void;
  onDeleteAllAppData: () => Promise<void> | void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/**
 * Mobile Phone Settings page:
 * - Pure #131313 canvas, Lexend typography
 * - Grouped rounded-3xl #1B1B1B cards
 * - Touch-friendly switch toggles and selectors
 * - Clean mobile account, streaming, lyrics, storage, and theme controls
 */
export function PhoneSettings({
  account,
  isSignedIn,
  onSignIn,
  onSignOut,
  potatoPcMode,
  onPotatoPcChange,
  madeForYouVisible,
  onMadeForYouChange,
  streamingQuality,
  onStreamingQualityChange,
  downloadQuality,
  onDownloadQualityChange,
  audioEngineMode,
  onAudioEngineModeChange,
  authenticatedStreaming,
  onAuthenticatedStreamingChange,
  youtubeScrobbling,
  onYouTubeScrobblingChange,
  gaplessEnabled,
  onGaplessChange,
  crossfadeSec,
  onCrossfadeChange,
  sessionRestoreEnabled,
  onSessionRestoreChange,
  preferredLyricsSource,
  onPreferredLyricsSourceChange,
  lyricsFontScale,
  onLyricsFontScaleChange,
  lyricsTranslationLang,
  onLyricsTranslationLangChange,
  cacheBytes,
  onClearCache,
  offlineBytes,
  offlineCount,
  offlineMaxGb,
  onOfflineMaxGbChange,
  onRemoveAllDownloads,
  lastFmSession,
  lastFmScrobblingEnabled,
  onLastFmScrobblingChange,
  onConnectLastFm,
  onDisconnectLastFm,
  installedVersion,
  updateInfo,
  isCheckingUpdate,
  onCheckForUpdates,
  onInstallUpdate,
  onRestartOnboarding,
  onDeleteAllAppData,
}: PhoneSettingsProps) {
  const [clearingCache, setClearingCache] = useState(false);
  const [clearingDownloads, setClearingDownloads] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  return (
    <div className="flex min-h-full flex-col bg-[#131313] px-5 pb-28 pt-2 font-lexend text-[#e7e7e7]">
      {/* Header */}
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold leading-tight tracking-normal text-white">
          Settings
        </h1>
        <p className="text-sm font-light text-[#929292]">
          Preferences, audio quality & accounts
        </p>
      </header>

      {/* Sections List */}
      <main className="mt-6 flex flex-col gap-5">
        {/* 1. ACCOUNT CARD */}
        <section className="flex flex-col gap-4 rounded-3xl bg-[#1b1b1b] p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-[#252525] text-white">
              <UserIcon size={18} />
            </span>
            <div className="flex flex-col">
              <h2 className="text-base font-semibold text-white">Account</h2>
              <span className="text-xs font-light text-[#929292]">
                {isSignedIn ? "Signed in to YouTube Music" : "No account connected"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-white">
                {isSignedIn ? account?.name || "YouTube Music" : "Guest"}
              </span>
              <span className="truncate text-xs font-light text-[#929292]">
                {isSignedIn ? "Recommendations & history active" : "Sign in to access your library"}
              </span>
            </div>

            {isSignedIn ? (
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="flex items-center gap-1.5 rounded-full bg-[#252525] px-4 py-2 text-xs font-medium text-[#e7e7e7] transition-transform active:scale-95"
              >
                <LogoutIcon size={14} />
                <span>Sign out</span>
              </button>
            ) : (
              <GoogleSignInButton
                onClick={() => void onSignIn()}
                size="sm"
              />
            )}
          </div>
        </section>

        {/* 2. AUDIO & STREAMING CARD */}
        <section className="flex flex-col gap-4 rounded-3xl bg-[#1b1b1b] p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-[#252525] text-white">
              <PlayIcon size={18} />
            </span>
            <div className="flex flex-col">
              <h2 className="text-base font-semibold text-white">Audio & Streaming</h2>
              <span className="text-xs font-light text-[#929292]">Bitrate and audio resolution</span>
            </div>
          </div>

          <div className="flex flex-col gap-3.5 divide-y divide-[#252525] pt-1">
            {/* Streaming Quality */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">Streaming quality</span>
                <span className="text-xs font-light text-[#929292]">Audio bitrate over network</span>
              </div>
              <Select
                value={streamingQuality}
                onValueChange={(val) => onStreamingQualityChange(val as AudioQuality)}
              >
                <SelectTrigger className="w-36 rounded-full bg-[#252525] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1b1b1b] text-xs text-white">
                  {(Object.keys(AUDIO_QUALITY_LABELS) as AudioQuality[]).map((q) => (
                    <SelectItem key={q} value={q}>
                      {AUDIO_QUALITY_LABELS[q]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Download Quality */}
            <div className="flex items-center justify-between gap-3 pt-3.5">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">Download quality</span>
                <span className="text-xs font-light text-[#929292]">Bitrate for offline music</span>
              </div>
              <Select
                value={downloadQuality}
                onValueChange={(val) => onDownloadQualityChange(val as AudioQuality)}
              >
                <SelectTrigger className="w-36 rounded-full bg-[#252525] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1b1b1b] text-xs text-white">
                  {(Object.keys(AUDIO_QUALITY_LABELS) as AudioQuality[]).map((q) => (
                    <SelectItem key={q} value={q}>
                      {AUDIO_QUALITY_LABELS[q]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Audio Engine Mode */}
            <div className="flex items-center justify-between gap-3 pt-3.5">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">Playback method</span>
                <span className="text-xs font-light text-[#929292]">
                  {audioEngineMode === "native" ? "Native (lightweight)" : "Webview frame (rich features)"}
                </span>
              </div>
              <Select
                value={audioEngineMode}
                onValueChange={(val) => onAudioEngineModeChange(val as AudioEngineMode)}
              >
                <SelectTrigger className="w-36 rounded-full bg-[#252525] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1b1b1b] text-xs text-white">
                  {AUDIO_ENGINE_MODES.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Scrobble to YouTube */}
            <div className="flex items-center justify-between gap-3 pt-3.5">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">Sync history with YouTube</span>
                <span className="text-xs font-light text-[#929292]">Feed plays into algorithm</span>
              </div>
              <Switch
                checked={youtubeScrobbling}
                onCheckedChange={onYouTubeScrobblingChange}
              />
            </div>

            {/* Authenticated Streaming */}
            <div className="flex items-center justify-between gap-3 pt-3.5">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">Stream as account</span>
                <span className="text-xs font-light text-[#929292]">Required for Premium bitrates</span>
              </div>
              <Switch
                checked={authenticatedStreaming}
                onCheckedChange={onAuthenticatedStreamingChange}
              />
            </div>
          </div>
        </section>

        {/* 3. PLAYBACK & TRANSITIONS */}
        <section className="flex flex-col gap-4 rounded-3xl bg-[#1b1b1b] p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-[#252525] text-white">
              <PlayIcon size={18} />
            </span>
            <div className="flex flex-col">
              <h2 className="text-base font-semibold text-white">Transitions & Session</h2>
              <span className="text-xs font-light text-[#929292]">Gapless, crossfade & resume</span>
            </div>
          </div>

          <div className="flex flex-col gap-3.5 divide-y divide-[#252525] pt-1">
            {/* Gapless Playback */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">Gapless playback</span>
                <span className="text-xs font-light text-[#929292]">No pause between songs</span>
              </div>
              <Switch
                checked={gaplessEnabled}
                onCheckedChange={onGaplessChange}
              />
            </div>

            {/* Crossfade */}
            <div className="flex flex-col gap-2 pt-3.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">Crossfade</span>
                <span className="text-xs font-light text-[#cfe86a] tabular-nums">
                  {crossfadeSec > 0 ? `${crossfadeSec}s` : "Off"}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={12}
                step={1}
                value={crossfadeSec}
                onChange={(e) => onCrossfadeChange(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#252525] accent-[#cfe86a]"
              />
            </div>

            {/* Session Restore */}
            <div className="flex items-center justify-between gap-3 pt-3.5">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">Restore playback on start</span>
                <span className="text-xs font-light text-[#929292]">Resume queue after closing app</span>
              </div>
              <Switch
                checked={sessionRestoreEnabled}
                onCheckedChange={onSessionRestoreChange}
              />
            </div>
          </div>
        </section>

        {/* 4. LYRICS SETTINGS */}
        <section className="flex flex-col gap-4 rounded-3xl bg-[#1b1b1b] p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-[#252525] text-white">
              <LyricsIcon size={18} />
            </span>
            <div className="flex flex-col">
              <h2 className="text-base font-semibold text-white">Lyrics</h2>
              <span className="text-xs font-light text-[#929292]">Source & display preferences</span>
            </div>
          </div>

          <div className="flex flex-col gap-3.5 divide-y divide-[#252525] pt-1">
            {/* Preferred source */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">Lyrics source</span>
                <span className="text-xs font-light text-[#929292]">Primary lyrics provider</span>
              </div>
              <Select
                value={preferredLyricsSource}
                onValueChange={onPreferredLyricsSourceChange}
              >
                <SelectTrigger className="w-36 rounded-full bg-[#252525] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1b1b1b] text-xs text-white">
                  <SelectItem value={AUTO_LYRICS_SOURCE}>Automatic</SelectItem>
                  {LYRICS_SOURCES.map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Text scale */}
            <div className="flex items-center justify-between gap-3 pt-3.5">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">Lyrics text size</span>
                <span className="text-xs font-light text-[#929292]">Scaling for lyrics view</span>
              </div>
              <Select
                value={String(lyricsFontScale)}
                onValueChange={(val) => onLyricsFontScaleChange(Number(val))}
              >
                <SelectTrigger className="w-36 rounded-full bg-[#252525] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1b1b1b] text-xs text-white">
                  {LYRICS_FONT_SCALES.map((scale) => (
                    <SelectItem key={scale.value} value={String(scale.value)}>
                      {scale.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Translation */}
            <div className="flex items-center justify-between gap-3 pt-3.5">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">Translate lyrics</span>
                <span className="text-xs font-light text-[#929292]">Subtitles under original</span>
              </div>
              <Select
                value={lyricsTranslationLang}
                onValueChange={onLyricsTranslationLangChange}
              >
                <SelectTrigger className="w-36 rounded-full bg-[#252525] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1b1b1b] text-xs text-white">
                  <SelectItem value={TRANSLATION_OFF}>Off</SelectItem>
                  {TRANSLATION_LANGUAGES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {getLanguageLabel(code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* 5. STORAGE & CACHE */}
        <section className="flex flex-col gap-4 rounded-3xl bg-[#1b1b1b] p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-[#252525] text-white">
              <DownloadIcon size={18} />
            </span>
            <div className="flex flex-col">
              <h2 className="text-base font-semibold text-white">Storage & Cache</h2>
              <span className="text-xs font-light text-[#929292]">Manage local disk usage</span>
            </div>
          </div>

          <div className="flex flex-col gap-3.5 divide-y divide-[#252525] pt-1">
            {/* Cache */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">App cache</span>
                <span className="text-xs font-light text-[#929292]">
                  {formatBytes(cacheBytes)} stored
                </span>
              </div>
              <button
                type="button"
                disabled={clearingCache || cacheBytes === 0}
                onClick={async () => {
                  setClearingCache(true);
                  await onClearCache().finally(() => setClearingCache(false));
                }}
                className="rounded-full bg-[#252525] px-3.5 py-1.5 text-xs font-medium text-[#e7e7e7] transition-transform active:scale-95 disabled:opacity-40"
              >
                {clearingCache ? "Clearing..." : "Clear cache"}
              </button>
            </div>

            {/* Offline storage limit */}
            <div className="flex flex-col gap-2 pt-3.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">Downloads storage limit</span>
                <span className="text-xs font-light text-[#cfe86a] tabular-nums">
                  {Math.round(offlineMaxGb)} GB
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={64}
                step={1}
                value={Math.round(offlineMaxGb)}
                onChange={(e) => onOfflineMaxGbChange(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#252525] accent-[#cfe86a]"
              />
              <span className="text-[11px] font-light text-[#929292]">
                Currently used: {offlineCount} songs ({formatBytes(offlineBytes)})
              </span>
            </div>

            {/* Clear all downloads */}
            <div className="flex items-center justify-between gap-3 pt-3.5">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">Downloaded music</span>
                <span className="text-xs font-light text-[#929292]">Remove all offline tracks</span>
              </div>
              <button
                type="button"
                disabled={clearingDownloads || offlineCount === 0}
                onClick={async () => {
                  setClearingDownloads(true);
                  await onRemoveAllDownloads().finally(() => setClearingDownloads(false));
                }}
                className="rounded-full bg-red-500/15 px-3.5 py-1.5 text-xs font-medium text-red-400 transition-transform active:scale-95 disabled:opacity-40"
              >
                {clearingDownloads ? "Removing..." : "Remove all"}
              </button>
            </div>
          </div>
        </section>

        {/* 6. APPEARANCE & PERFORMANCE */}
        <section className="flex flex-col gap-4 rounded-3xl bg-[#1b1b1b] p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-[#252525] text-white">
              <PaletteIcon size={18} />
            </span>
            <div className="flex flex-col">
              <h2 className="text-base font-semibold text-white">Appearance</h2>
              <span className="text-xs font-light text-[#929292]">Theme and performance</span>
            </div>
          </div>

          <div className="flex flex-col gap-3.5 divide-y divide-[#252525] pt-1">
            {/* Theme */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">Theme</span>
                <span className="text-xs font-light text-[#929292]">Exclusive dark experience</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-[#252525] px-3.5 py-1.5 text-xs font-medium text-white">
                <span className="size-2 rounded-full bg-[#cfe86a]" />
                <span>Dark</span>
              </div>
            </div>

            {/* Potato PC (Lightweight Mode) */}
            <div className="flex items-center justify-between gap-3 pt-3.5">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">Power saver mode</span>
                <span className="text-xs font-light text-[#929292]">Disable blurs for longer battery</span>
              </div>
              <Switch
                checked={potatoPcMode}
                onCheckedChange={onPotatoPcChange}
              />
            </div>

            {/* Made for you section */}
            <div className="flex items-center justify-between gap-3 pt-3.5">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">Home recommendations</span>
                <span className="text-xs font-light text-[#929292]">Show personalized shelves</span>
              </div>
              <Switch
                checked={madeForYouVisible}
                onCheckedChange={onMadeForYouChange}
              />
            </div>
          </div>
        </section>

        {/* 7. INTEGRATIONS */}
        <section className="flex flex-col gap-4 rounded-3xl bg-[#1b1b1b] p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-[#252525] text-white">
              <LastFmIcon size={18} />
            </span>
            <div className="flex flex-col">
              <h2 className="text-base font-semibold text-white">Last.fm</h2>
              <span className="text-xs font-light text-[#929292]">
                {lastFmSession ? `Connected as ${lastFmSession.username}` : "Not connected"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white">Scrobble plays</span>
              <span className="text-xs font-light text-[#929292]">Log listening activity</span>
            </div>
            {lastFmSession ? (
              <div className="flex items-center gap-2.5">
                <Switch
                  checked={lastFmScrobblingEnabled}
                  onCheckedChange={onLastFmScrobblingChange}
                />
                <button
                  type="button"
                  onClick={onDisconnectLastFm}
                  className="rounded-full bg-[#252525] px-3 py-1.5 text-xs font-medium text-[#929292] transition-colors hover:text-white active:scale-95"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onConnectLastFm}
                className="rounded-full bg-white px-4 py-2 text-xs font-medium text-[#131313] transition-transform active:scale-95"
              >
                Connect
              </button>
            )}
          </div>
        </section>

        {/* 8. ABOUT & MAINTENANCE */}
        <section className="flex flex-col gap-4 rounded-3xl bg-[#1b1b1b] p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-base font-semibold text-white">Zuno</span>
              <span className="text-xs font-light text-[#929292]">
                Version {installedVersion || "1.0.0"}
              </span>
            </div>

            <button
              type="button"
              disabled={isCheckingUpdate}
              onClick={onCheckForUpdates}
              className="flex items-center gap-1.5 rounded-full bg-[#252525] px-3.5 py-1.5 text-xs font-medium text-[#e7e7e7] transition-transform active:scale-95"
            >
              <RefreshIcon size={14} className={cn(isCheckingUpdate && "animate-spin")} />
              <span>{isCheckingUpdate ? "Checking..." : "Check update"}</span>
            </button>
          </div>

          {updateInfo && (
            <div className="flex items-center justify-between rounded-2xl bg-[#252525] p-3 text-xs">
              <span className="text-[#cfe86a]">Update v{updateInfo.version} available</span>
              <button
                type="button"
                onClick={onInstallUpdate}
                className="rounded-full bg-white px-3 py-1 font-medium text-[#131313]"
              >
                Update now
              </button>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={onRestartOnboarding}
              className="w-full rounded-2xl bg-[#252525] py-3 text-center text-xs font-medium text-white transition-transform active:scale-98"
            >
              Restart introduction tour
            </button>

            <button
              type="button"
              onClick={() => {
                if (confirmDeleteAll) {
                  void onDeleteAllAppData();
                  setConfirmDeleteAll(false);
                } else {
                  setConfirmDeleteAll(true);
                  setTimeout(() => setConfirmDeleteAll(false), 4000);
                }
              }}
              className={cn(
                "w-full rounded-2xl py-3 text-center text-xs font-medium transition-all active:scale-98",
                confirmDeleteAll
                  ? "bg-red-500/25 text-red-400"
                  : "bg-transparent text-red-400/80 hover:bg-red-500/10 hover:text-red-400",
              )}
            >
              {confirmDeleteAll ? "Tap again to erase all data" : "Delete all app data"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
