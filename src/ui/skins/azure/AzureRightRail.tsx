import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Track } from "../../../datasource/types";
import { usePlayHistory } from "../../../player/playHistory";
import { playerController, useLibraryState } from "../../../player/playerStore";
import { TrackArtwork } from "../../components/TrackArtwork";
import { ArtistLinks } from "../../components/ArtistLinks";
import type { SidebarNav } from "../../components/Sidebar";
import { useNowPlaying } from "../../hooks/useNowPlaying";
import { AzureGridIcon } from "./azureIcons";

/** From the design: a 298px column, flush with the window's right edge. */
export const AZURE_RAIL_WIDTH = 298;

const RECENT_LIMIT = 8;

/** "2min ago", "6hr ago", "3d ago" — the short form the design uses beside each row. */
function timeAgo(playedAt: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - playedAt) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}hr ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface AzureRightRailProps {
  nav?: SidebarNav;
}

/**
 * Azure's right-hand column: who is signed in, and what you played last.
 *
 * "Recent Played" is the app's own play history (the same list the History page shows), so a row
 * is real and clicking it plays it. While the queue panel is open it takes this column's place;
 * closing it brings the rail back.
 */
export function AzureRightRail({ nav }: AzureRightRailProps) {
  const { t } = useTranslation();
  const history = usePlayHistory();
  const libraryState = useLibraryState();
  const { currentTrackId, isPlaying } = useNowPlaying();
  const account = libraryState.library?.account;
  const isSignedIn = libraryState.status === "ready" && Boolean(account);

  // Newest first, one row per song however often it was replayed.
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const rows: { track: Track; playedAt: number }[] = [];
    for (const entry of [...history].sort((a, b) => b.playedAt - a.playedAt)) {
      if (seen.has(entry.track.id)) continue;
      seen.add(entry.track.id);
      rows.push(entry);
      if (rows.length === RECENT_LIMIT) break;
    }
    return rows;
  }, [history]);

  const queue = useMemo(() => recent.map((row) => row.track), [recent]);
  const now = Date.now();
  const name = account?.name || t("azure.guest", "WEAV");

  return (
    <aside
      aria-label={t("azure.recentPlayed", "Recent Played")}
      className="flex h-full min-h-0 flex-col bg-[var(--azure-panel)] px-8 pb-4 pt-5"
      style={{ width: AZURE_RAIL_WIDTH }}
    >
      <div className="flex h-[72px] shrink-0 items-center gap-3 pt-1">
        {account?.artworkUrl ? (
          <img
            src={account.artworkUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="size-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--azure-accent)] text-lg font-semibold text-white"
          >
            {name.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-base font-medium text-white">{name}</span>
          <span className="flex items-center gap-1.5 text-xs text-[var(--azure-muted)]">
            {isSignedIn
              ? t("azure.signedIn", "Signed in")
              : t("azure.notSignedIn", "Not signed in")}
            <span
              aria-hidden="true"
              className={cn(
                "size-1 rounded-full",
                isSignedIn ? "bg-[var(--azure-accent)]" : "bg-[var(--azure-muted)]",
              )}
            />
          </span>
        </span>
        <button
          type="button"
          onClick={nav?.onSettings}
          aria-label={t("sidebar.settings")}
          className="grid size-8 shrink-0 place-items-center rounded-full text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <AzureGridIcon size={18} />
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-xl font-medium text-white">{t("azure.recentPlayed", "Recent Played")}</h2>
        <button
          type="button"
          onClick={nav?.onHistory}
          className="rounded-sm text-base text-[var(--azure-accent)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("azure.seeAll", "See All")}
        </button>
      </div>

      {recent.length === 0 ? (
        <p className="mt-6 text-sm leading-relaxed text-[var(--azure-muted)]">
          {t("azure.recentEmpty", "Songs you play will show up here.")}
        </p>
      ) : (
        <ul className="mt-5 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
          {recent.map(({ track, playedAt }) => {
            const isCurrent = track.id === currentTrackId;
            return (
              <li key={track.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => void playerController.playTrackById(track.id, queue)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    void playerController.playTrackById(track.id, queue);
                  }}
                  aria-current={isCurrent ? "true" : undefined}
                  className="flex cursor-pointer items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <TrackArtwork
                    className="size-11 shrink-0 rounded-lg object-cover"
                    size={44}
                    artworkUrl={track.artworkUrl}
                    iconSize={20}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={cn(
                        "truncate text-[15px] font-medium leading-5",
                        isCurrent ? "text-[var(--azure-accent)]" : "text-white",
                      )}
                    >
                      {track.title}
                    </span>
                    <ArtistLinks
                      className="truncate text-[13px] leading-4 text-[var(--azure-muted)]"
                      artists={track.artists}
                      fallback={track.artist}
                    />
                  </span>
                  <span className="shrink-0 self-start pt-1 text-[13px] text-[var(--azure-muted)]">
                    {isCurrent && isPlaying ? t("azure.playingNow", "Playing") : timeAgo(playedAt, now)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
