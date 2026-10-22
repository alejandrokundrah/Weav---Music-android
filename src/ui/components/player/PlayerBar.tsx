import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SpinnerSteps } from "@/components/motion/loader";
import { cn } from "@/lib/utils";
import { PlayActiveIcon, QueuePanelIcon } from "@/ui/icons";
import { useTranslation } from "react-i18next";
import { AzureWaveformIcon } from "../../skins/azure/azureIcons";
import { usePlayerUIState } from "../../stores/playerUIStore";
import { usePlayerSelector } from "../../../player/playerStore";
import { tauriFetch } from "../../../datasource/youtube/tauriFetch";
import { setOnline, useOnline } from "../../../internal/connectivity";
import { TrackInfo } from "./TrackInfo";
import { PlaybackControls } from "./PlaybackControls";
import { SeekBar } from "./SeekBar";
import { DownloadButton } from "./DownloadButton";
import { PlaybackOptions } from "./PlaybackOptions";
import { VolumeControl } from "./VolumeControl";
import { LyricsButton } from "./LyricsButton";
import { useCompactViewport } from "../../hooks/useCompactViewport";
import {
  useCompactPlayerBar,
  useExtraPlayerControlsAlwaysVisible,
} from "../../settings/playerControls";

interface PlayerBarProps {
  onToggleLyrics: () => void;
  onToggleQueue: () => void;
  isQueueOpen: boolean;
  onConnectionRestored: () => Promise<void>;
  handlePlayerBarClick:()=>void;
  /**
   * Which desktop skin is drawing the bar. Only the outer surface and where the seek bar sits
   * differ; the connection handling and every control inside are shared by both skins.
   */
  variant?: "glass" | "noir" | "azure";
}

/*
 * Two endpoints so one being blocked does not read as "offline", and both answer 204 with an
 * empty body. This used to lead with `https://music.youtube.com/`, which is 380 KB of HTML
 * fetched only to prove the network exists — and `allSettled` requests both, so every check
 * paid for it. gstatic keeps the "can we reach Google" signal at zero bytes.
 */
const CONNECTION_CHECK_URLS = [
  "https://www.gstatic.com/generate_204",
  "https://cp.cloudflare.com/generate_204",
];

export function PlayerBar({ onToggleLyrics, onToggleQueue, isQueueOpen, onConnectionRestored,handlePlayerBarClick, variant = "glass" }: PlayerBarProps) {
  const isNoir = variant === "noir";
  const isAzure = variant === "azure";
  const { t } = useTranslation();
  const lyricsOpen = usePlayerUIState().isLyricsOpen;
  const hasTrack = usePlayerSelector((state) => state.currentTrack !== null);
  const isOnline = useOnline();
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
 
  const connectionCheckRef = useRef<Promise<boolean> | null>(null);
  const wasOfflineRef = useRef(!navigator.onLine);
  const recoveryStartedRef = useRef(false);
  const failedChecksRef = useRef(0);

  const updateConnectionState = useCallback((connected: boolean) => {
    if (connected) failedChecksRef.current = 0;
    setOnline(connected);

    if (!connected) {
      wasOfflineRef.current = true;
      return;
    }

    if (wasOfflineRef.current && !recoveryStartedRef.current) {
      recoveryStartedRef.current = true;
      void onConnectionRestored();
    }
  }, [onConnectionRestored]);

  const checkConnection = useCallback(async () => {
    if (connectionCheckRef.current) return connectionCheckRef.current;

    const check = (async () => {
      if (!navigator.onLine) {
        failedChecksRef.current += 1;
        if (failedChecksRef.current >= 2) {
          updateConnectionState(false);
        } else {
          window.setTimeout(() => void checkConnection(), 1500);
        }
        return false;
      }

      const checks = await Promise.allSettled(
        CONNECTION_CHECK_URLS.map((url) =>
          tauriFetch(url, {
            cache: "no-store",
            method: "GET",
          })
        ),
      );
      const connected = checks.some((result) => result.status === "fulfilled");
      if (connected) {
        updateConnectionState(true);
      } else {
        failedChecksRef.current += 1;
        if (failedChecksRef.current >= 2) {
          updateConnectionState(false);
        } else {
          window.setTimeout(() => void checkConnection(), 1500);
        }
      }
      return connected;
    })();

    connectionCheckRef.current = check;
    try {
      return await check;
    } finally {
      connectionCheckRef.current = null;
    }
  }, [updateConnectionState]);

  useEffect(() => {
    const handleOnline = () => void checkConnection();
    const handleOffline = () => void checkConnection();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkConnection();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    void checkConnection();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkConnection, updateConnectionState]);

  useEffect(() => {
    if (isOnline) return;

    const retryTimer = window.setInterval(() => {
      void checkConnection();
    }, 5000);

    return () => window.clearInterval(retryTimer);
  }, [checkConnection, isOnline]);

  const reconnect = async () => {
    setIsCheckingConnection(true);

    try {
      await checkConnection();
    } finally {
      setIsCheckingConnection(false);
    }
  };

  const extraControlsAlwaysVisible = useExtraPlayerControlsAlwaysVisible();
  const compactPlayerBar = useCompactPlayerBar();
  const isPhone = useCompactViewport();



  return (
    <>
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex shrink-0 items-center justify-center gap-3 overflow-hidden bg-muted px-2 py-1  text-sm text-foreground"
            role="status"
            aria-live="polite"
          >
            <span>You don't have an internet connection</span>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => void reconnect()}
              disabled={isCheckingConnection}
              aria-label="Reconnect to the internet"
            >
              {isCheckingConnection ? (
                <SpinnerSteps   size={24}  />
              ) : (
                <PlayActiveIcon size={14} aria-hidden="true" />
              )}
              <span>{isCheckingConnection ? "Checking" : "Reconnect"}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {isPhone ? (
        /* One row on a phone: what is playing, the transport, the queue; the seek bar under it.
           Volume, download, playback options and lyrics are desktop-width luxuries here. */
        <div
          className="group/playerbar mx-3 mb-2 flex shrink-0 flex-col gap-1 rounded-3xl bg-card px-3 pb-2 pt-2"
        >
          <div className="flex items-center gap-2">
            {/* Tapping the song opens the full-screen player; the buttons inside it (like)
                keep their own meaning. */}
            <div
              className="min-w-0 flex-1"
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("button")) return;
                handlePlayerBarClick();
              }}
            >
              <TrackInfo />
            </div>
            <PlaybackControls compact extraControlsAlwaysVisible />
            <div className="flex shrink-0 items-center gap-0.5">
              <DownloadButton />
              <button
                type="button"
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isQueueOpen ? "bg-card text-primary" : "text-muted-foreground",
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleQueue();
                }}
                aria-label={isQueueOpen ? "Close queue" : "Open queue"}
              >
                <QueuePanelIcon size={18} />
              </button>
            </div>
          </div>
          <SeekBar />
        </div>
      ) : isAzure ? (
      <div
        // Azure: a docked strip with the progress line across its very top. The seek line sits
        // half above the bar's edge so it reads as the border between page and player.
        data-azure-player=""
        className="group/playerbar relative flex h-[108px] shrink-0 flex-col justify-center bg-[rgb(18_18_18/0.94)]"
        onClick={handlePlayerBarClick}
      >
        <div
          className="absolute inset-x-0 -top-1.5 z-10 flex h-3 items-center"
          onClick={(event) => event.stopPropagation()}
        >
          <SeekBar variant="line" />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6 px-8">
          <div className="min-w-0">
            <TrackInfo />
          </div>

          <PlaybackControls extraControlsAlwaysVisible />

          <div className="flex min-w-0 items-center justify-end gap-5">
            <DownloadButton />
            <SeekBar variant="time" />
            <VolumeControl variant="inline" />
            <button
              type="button"
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isQueueOpen ? "bg-white/10 text-[var(--azure-accent)]" : "hover:bg-white/10",
              )}
              onClick={(event) => {
                event.stopPropagation();
                onToggleQueue();
              }}
              aria-label={isQueueOpen ? "Close queue" : "Open queue"}
              title={isQueueOpen ? "Close queue" : "Open queue"}
            >
              <QueuePanelIcon size={18} />
            </button>
            {/* The design's waveform is the lyrics toggle: the one thing it says is "listening". */}
            <button
              type="button"
              className={cn(
                "flex size-8 items-center justify-center rounded-full transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-40",
                lyricsOpen ? "bg-white/10" : "hover:bg-white/10",
              )}
              onClick={(event) => {
                event.stopPropagation();
                onToggleLyrics();
              }}
              disabled={!hasTrack}
              aria-label={lyricsOpen ? t("player.closeLyrics", "Close lyrics") : t("player.openLyrics", "Open lyrics")}
              aria-pressed={lyricsOpen}
            >
              <AzureWaveformIcon size={20} />
            </button>
          </div>
        </div>
      </div>
      ) : (
      <div
        // A floating capsule, not a docked strip: it rounds, darkens and lifts off the page, and
        // the page's own column gives it the margin — so the queue rail beside it runs the full
        // height of the window instead of ending at the bar.
        className={cn(
          "group/playerbar flex shrink-0 flex-col gap-2 rounded-[26px] bg-black/25 px-5 py-3.5 shadow-lg shadow-black/20 ring-1 ring-inset ring-white/10",
          // Noir: a flat docked strip, full width, with one hairline above it.
          isNoir && "gap-1 rounded-none bg-[var(--noir-bar)] px-10 py-3 shadow-none ring-0 border-t border-[var(--noir-hairline)]",
        )}
        onClick={handlePlayerBarClick}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
          <div className="min-w-0">
            <TrackInfo />
          </div>

          {/* Compact: the seek bar tucks under the controls, in the centre column only, so
              the bar keeps one row of height and the transport stays the anchor. */}
          <div className="flex flex-col items-center gap-1">
            <PlaybackControls extraControlsAlwaysVisible={extraControlsAlwaysVisible} />
            {(compactPlayerBar || isNoir) && (
              <div className="w-full min-w-[22rem]">
                <SeekBar />
              </div>
            )}
          </div>

          <div className="flex min-w-0 items-center justify-end gap-1">
            <div
              className={cn(
                "flex items-center gap-1 transition-opacity",
                !extraControlsAlwaysVisible &&
                  "opacity-0 focus-within:opacity-100 group-hover/playerbar:opacity-100",
              )}
            >
              <LyricsButton onToggle={onToggleLyrics} />

              <button
                type="button"
                className={cn(
                  "flex size-8 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isQueueOpen
                    ? "bg-card text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={onToggleQueue}
                aria-label={isQueueOpen ? "Close queue" : "Open queue"}
                title={isQueueOpen ? "Close queue" : "Open queue"}
              >
                <QueuePanelIcon size={18} />
              </button>
            </div>

            <DownloadButton />
            <PlaybackOptions />
            <VolumeControl variant={isNoir ? "noir-inline" : "popover"} />
          </div>
        </div>

        {/* Expanded: the seek bar runs the full width of the capsule, under the transport —
            the design's arrangement. Compact tucks it inside the centre column above. */}
        {!compactPlayerBar && !isNoir && <SeekBar />}
      </div>
      )}
    </>
  );
}
