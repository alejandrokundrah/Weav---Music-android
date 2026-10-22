import { useEffect, useMemo, useState, useSyncExternalStore, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Album, Playlist } from "../../../datasource/types";
import { useLibraryState } from "../../../player/playerStore";
import {
  getLocalPlaylistItems,
  subscribeToLocalPlaylists,
} from "../../../player/localPlaylists";
import {
  getRecentPlaylistTimestamp,
  subscribeToRecentPlaylists,
} from "../../../player/recentPlaylists";
import { CreatePlaylistButton, type SidebarNav } from "../../components/Sidebar";
import { usePlaylistContextMenu } from "../../components/PlaylistContextMenu";
import {
  AzureAlbumNoteIcon,
  AzureDiscoverIcon,
  AzureFavoriteHeartIcon,
  AzureHomeIcon,
  AzureLogo,
  AzurePlaylistNoteIcon,
  AzureRadioIcon,
  AzureRecentlyAddedIcon,
  type AzureIconProps,
} from "./azureIcons";

/** From the design: a 270px rail, flush with the window's left edge. */
export const AZURE_SIDEBAR_WIDTH = 270;

/*
 * The same keys the glass sidebar stores a hand-arranged order under. Read-only here, but
 * honouring the stored order means a library arranged in one skin does not come up shuffled in
 * another.
 */
const PLAYLIST_ORDER_KEY = "ytc-sidebar-playlist-order";

function readStoredOrder(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

/** Puts `items` into `order`, with anything the order does not mention after, in its own order. */
function applyOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (!order.length) return items;
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = order.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
  const seen = new Set(ordered.map((item) => item.id));
  return [...ordered, ...items.filter((item) => !seen.has(item.id))];
}

type NavIcon = ComponentType<AzureIconProps>;

const ROW =
  "group/nav relative flex h-12 w-full items-center gap-[18px] pl-[34px] pr-6 text-left text-base " +
  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

function NavRow({
  icon: Icon,
  label,
  active,
  onClick,
  onContextMenu,
  title,
}: {
  icon: NavIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      onClick={onClick}
      onContextMenu={onContextMenu}
      aria-current={active ? "page" : undefined}
      className={cn(
        ROW,
        active
          ? "bg-[linear-gradient(90deg,rgb(255_255_255/0.13),rgb(255_255_255/0)_100%)] text-white"
          : "text-[var(--azure-muted)] hover:text-white",
      )}
    >
      <Icon size={20} className="shrink-0" />
      <span className="truncate">{label}</span>
      {/* Where you are: a short blue tab on the rail's right edge. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute right-0 top-0 h-full w-1.5 rounded-l-[3px] bg-[var(--azure-accent)] transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
    </button>
  );
}

function SectionLabel({ children, trailing }: { children: string; trailing?: React.ReactNode }) {
  return (
    <div className="flex h-8 items-center justify-between pl-8 pr-[30px]">
      <h2 className="text-xs font-bold uppercase leading-none tracking-[0.16em] text-[var(--azure-muted)]">
        {children}
      </h2>
      {trailing}
    </div>
  );
}

interface AzureSidebarProps {
  width: number;
  onWidthChange: (width: number) => void;
  nav?: SidebarNav;
  onNavigateAlbum: (album: Album) => void;
  onNavigatePlaylist: (playlist: Playlist) => void;
}

/**
 * Azure's left rail: the brand mark, five destinations with filled icons, then a Library group
 * and the playlists.
 *
 * The data is the same the other sidebars show — Liked Songs, local playlists and your YouTube
 * Music playlists — with the same right-click menus, so managing a playlist is not skin-specific.
 */
export function AzureSidebar({
  width,
  onWidthChange,
  nav,
  onNavigatePlaylist,
}: AzureSidebarProps) {
  const { t } = useTranslation();
  const libraryState = useLibraryState();
  const { openPlaylistMenu } = usePlaylistContextMenu();
  const [recentRevision, setRecentRevision] = useState(0);

  const localPlaylists = useSyncExternalStore(
    subscribeToLocalPlaylists,
    getLocalPlaylistItems,
    getLocalPlaylistItems,
  );

  useEffect(() => {
    if (width !== AZURE_SIDEBAR_WIDTH) onWidthChange(AZURE_SIDEBAR_WIDTH);
  }, [onWidthChange, width]);

  useEffect(
    () => subscribeToRecentPlaylists(() => setRecentRevision((revision) => revision + 1)),
    [],
  );

  const library = libraryState.library;
  const likedSongs = library?.likedSongsPlaylist;

  const playlists = useMemo(() => {
    const remote = (library?.playlists ?? [])
      .filter((playlist) => playlist.id !== likedSongs?.id)
      .map((playlist, libraryIndex) => ({
        playlist,
        libraryIndex,
        playedAt: getRecentPlaylistTimestamp(playlist.id),
      }))
      .sort((a, b) => b.playedAt - a.playedAt || a.libraryIndex - b.libraryIndex)
      .map(({ playlist }) => playlist);

    // Liked Songs has its own row under Library, so it is not repeated in this list.
    return applyOrder([...localPlaylists, ...remote], readStoredOrder(PLAYLIST_ORDER_KEY));
    // `recentRevision` is the trigger: recency changes without any of the lists changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library?.playlists, likedSongs, localPlaylists, recentRevision]);

  const activeItemId = nav?.activeItemId;

  return (
    <aside
      aria-label="Library"
      className="flex min-h-0 shrink-0 flex-col bg-[var(--azure-panel)]"
      style={{ width: AZURE_SIDEBAR_WIDTH }}
    >
      <div className="flex h-[76px] shrink-0 items-center pl-6">
        <button
          type="button"
          onClick={nav?.onHome}
          aria-label={t("sidebar.home")}
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <AzureLogo height={41} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-4 pt-6">
        {nav && (
          <nav aria-label="Main" className="flex shrink-0 flex-col">
            <NavRow
              icon={AzureHomeIcon}
              label={t("sidebar.home")}
              active={nav.activeView === "home"}
              onClick={nav.onHome}
            />
            <NavRow
              icon={AzureDiscoverIcon}
              label={t("azure.discover", "Discover")}
              active={nav.activeView === "browse" && nav.activeBrowseTab !== "downloads"}
              onClick={nav.onBrowse}
            />
            <NavRow
              icon={AzureRadioIcon}
              label={t("common.downloads")}
              active={nav.activeView === "browse" && nav.activeBrowseTab === "downloads"}
              onClick={nav.onDownloads}
            />
            <NavRow
              icon={AzureAlbumNoteIcon}
              label={t("sidebar.albums")}
              active={nav.activeView === "library"}
              onClick={nav.onLibrary}
            />
          </nav>
        )}

        <div className="mt-9 flex shrink-0 flex-col">
          <SectionLabel>{t("noir.library", "Library")}</SectionLabel>
          <div className="mt-1 flex flex-col">
            {nav && (
              <NavRow
                icon={AzureRecentlyAddedIcon}
                label={t("sidebar.recentlyPlayed")}
                active={nav.activeView === "history"}
                onClick={nav.onHistory}
              />
            )}
            {likedSongs && (
              <NavRow
                icon={AzureFavoriteHeartIcon}
                label={t("azure.favoriteSongs", "Favorite Songs")}
                active={activeItemId === likedSongs.id}
                onClick={() => onNavigatePlaylist(likedSongs)}
                onContextMenu={(event) => openPlaylistMenu(event, likedSongs)}
              />
            )}
          </div>
        </div>

        <div className="mt-9 flex min-h-0 flex-1 flex-col">
          <SectionLabel
            trailing={
              <CreatePlaylistButton
                canCreateRemote={libraryState.status === "ready"}
                collapsed
                triggerClassName="mx-0 my-0 size-6 rounded-md border-0 bg-transparent p-0 text-[var(--azure-muted)] hover:bg-transparent hover:text-white"
                onCreated={(playlist) => onNavigatePlaylist(playlist)}
              />
            }
          >
            {t("sidebar.playlists")}
          </SectionLabel>
          <div className="mt-1 flex min-h-0 flex-1 flex-col overflow-y-auto">
            {playlists.map((playlist) => (
              <NavRow
                key={playlist.id}
                icon={AzurePlaylistNoteIcon}
                label={playlist.title}
                active={activeItemId === playlist.id}
                onClick={() => onNavigatePlaylist(playlist)}
                onContextMenu={(event) => openPlaylistMenu(event, playlist)}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
