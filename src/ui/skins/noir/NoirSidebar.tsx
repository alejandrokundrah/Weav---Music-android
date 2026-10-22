import { useEffect, useMemo, useState, useSyncExternalStore, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { AlbumIcon, CompassIcon, DownloadIcon, HomeIcon } from "@/ui/icons";
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

/**
 * Wide enough for a comfortable line of text, narrow enough to leave the page its air. The window
 * reads this too: the brand block in the top bar is sized to it so the two line up.
 */
export const NOIR_SIDEBAR_WIDTH = 296;

/*
 * The same keys the glass sidebar stores a hand-arranged order under. Read-only here — dragging
 * rows around is a glass-sidebar feature — but honouring the stored order means a library arranged
 * in one skin does not come up shuffled in the other.
 */
const PLAYLIST_ORDER_KEY = "ytc-sidebar-playlist-order";
const ALBUM_ORDER_KEY = "ytc-sidebar-album-order";

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

type NavIcon = ComponentType<{ size?: number | string; className?: string }>;

function SectionHeading({ children }: { children: string }) {
  return (
    <h2 className="px-0 text-[13px] font-semibold leading-none tracking-normal text-foreground">
      {children}
    </h2>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: NavIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/nav relative flex items-center gap-3 rounded-sm py-1.5 pl-3 text-left text-[13px] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {/* The one splash of colour in the rail: a dot where you are. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 size-1 rounded-full bg-primary transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      <Icon size={16} className="shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function LibraryItem({
  label,
  active,
  onClick,
  onContextMenu,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      onContextMenu={onContextMenu}
      aria-current={active ? "page" : undefined}
      className={cn(
        "block w-full truncate rounded-sm py-1.5 pl-3 text-left text-[13px] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

interface NoirSidebarProps {
  width: number;
  onWidthChange: (width: number) => void;
  nav?: SidebarNav;
  onNavigateAlbum: (album: Album) => void;
  onNavigatePlaylist: (playlist: Playlist) => void;
}

/**
 * Noir's left rail: two plain lists under two small headings, no artwork, no boxes.
 *
 * Browse Music is where you can go; Library is what you own. The library list is the same data the
 * glass sidebar shows — Liked Songs, local playlists, your YouTube Music playlists and saved
 * albums — with the same right-click menus, so nothing about managing a playlist is skin-specific.
 */
export function NoirSidebar({
  width,
  onWidthChange,
  nav,
  onNavigateAlbum,
  onNavigatePlaylist,
}: NoirSidebarProps) {
  const { t } = useTranslation();
  const libraryState = useLibraryState();
  const { openPlaylistMenu, openAlbumMenu } = usePlaylistContextMenu();
  const [libraryView, setLibraryView] = useState<"playlists" | "albums">("playlists");
  const [recentRevision, setRecentRevision] = useState(0);

  const localPlaylists = useSyncExternalStore(
    subscribeToLocalPlaylists,
    getLocalPlaylistItems,
    getLocalPlaylistItems,
  );

  // The window sizes its brand block from this, so report the rail's width once it is known.
  useEffect(() => {
    if (width !== NOIR_SIDEBAR_WIDTH) onWidthChange(NOIR_SIDEBAR_WIDTH);
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

    const all = [...(likedSongs ? [likedSongs] : []), ...localPlaylists, ...remote];
    const ordered = applyOrder(all, readStoredOrder(PLAYLIST_ORDER_KEY));
    // Liked Songs is pinned first whatever the stored order says, as it is in the glass rail.
    return likedSongs
      ? [likedSongs, ...ordered.filter((playlist) => playlist.id !== likedSongs.id)]
      : ordered;
    // `recentRevision` is the trigger: recency changes without any of the lists changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library?.playlists, likedSongs, localPlaylists, recentRevision]);

  const albums = useMemo(
    () => applyOrder(library?.albums ?? [], readStoredOrder(ALBUM_ORDER_KEY)),
    [library?.albums],
  );

  const activeItemId = nav?.activeItemId;

  return (
    <aside
      aria-label="Library"
      className="flex min-h-0 shrink-0 flex-col"
      style={{ width: NOIR_SIDEBAR_WIDTH }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto pb-6 pl-10 pr-4 pt-7">
        {nav && (
          <section className="flex shrink-0 flex-col gap-3">
            <SectionHeading>{t("noir.browseMusic", "Browse Music")}</SectionHeading>
            <nav aria-label="Main" className="flex flex-col">
              <NavItem
                icon={HomeIcon}
                label={t("sidebar.home")}
                active={nav.activeView === "home"}
                onClick={nav.onHome}
              />
              <NavItem
                icon={CompassIcon}
                label={t("sidebar.browse")}
                active={nav.activeView === "browse" && nav.activeBrowseTab !== "downloads"}
                onClick={nav.onBrowse}
              />
              <NavItem
                icon={AlbumIcon}
                label={t("sidebar.library")}
                active={nav.activeView === "library"}
                onClick={nav.onLibrary}
              />
              <NavItem
                icon={DownloadIcon}
                label={t("common.downloads")}
                active={nav.activeView === "browse" && nav.activeBrowseTab === "downloads"}
                onClick={nav.onDownloads}
              />
            </nav>
          </section>
        )}

        <section className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <SectionHeading>{t("noir.library", "Library")}</SectionHeading>
            <div
              role="group"
              aria-label="Library view"
              className="flex items-center gap-3 text-[11px]"
            >
              {(["playlists", "albums"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  aria-pressed={libraryView === view}
                  onClick={() => setLibraryView(view)}
                  className={cn(
                    "rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    libraryView === view
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {view === "playlists" ? t("sidebar.playlists") : t("sidebar.albums")}
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {/* Plain text like the rest of the list: the design's library has no icons. */}
            {nav && (
              <LibraryItem
                label={t("sidebar.recentlyPlayed")}
                active={nav.activeView === "history"}
                onClick={nav.onHistory}
              />
            )}

            {libraryView === "playlists"
              ? playlists.map((playlist) => (
                  <LibraryItem
                    key={playlist.id}
                    label={playlist.title}
                    active={activeItemId === playlist.id}
                    onClick={() => onNavigatePlaylist(playlist)}
                    onContextMenu={(event) => openPlaylistMenu(event, playlist)}
                  />
                ))
              : albums.map((album) => (
                  <LibraryItem
                    key={album.id}
                    label={album.title}
                    active={activeItemId === album.id}
                    onClick={() => onNavigateAlbum(album)}
                    onContextMenu={(event) => openAlbumMenu(event, album)}
                  />
                ))}
          </div>

          <CreatePlaylistButton
            canCreateRemote={libraryState.status === "ready"}
            collapsed={false}
            // Quiet text link, not the glass rail's dashed block: an affordance, not a destination.
            triggerClassName="mx-0 my-0 h-8 justify-start rounded-sm border-0 bg-transparent px-0 text-[12px] font-normal hover:bg-transparent"
            onCreated={(playlist) => {
              setLibraryView("playlists");
              onNavigatePlaylist(playlist);
            }}
          />
        </section>
      </div>
    </aside>
  );
}
