import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/motion/tooltip";
import { DiscordIcon, DownloadIcon, LastFmIcon, LoginIcon, SettingsIcon, YouTubeMusicIcon } from "@/ui/icons";
import { HamburgerMenuIcon } from "@solar-icons/react/linear/hamburger-menu";
import { DiscordRpcService } from "../../player/DiscordRPC";
import { useDiscordPresenceEnabled } from "../settings/discord";
import { setLastFmScrobblingEnabled, useLastFmScrobblingEnabled } from "../settings/lastfm";
import { setYouTubeScrobbling, useYouTubeScrobbling } from "../settings/youtubeAccount";
import { logInternalError, logInternalInfo, logInternalWarn } from "../../internal/logging";
import {
  isLinux,
  isTilingWindowManager,
  subscribeTilingWindowManager,
} from "../platform";
import { MusicTabs } from "./MusicTabs";
import type { Tab } from "../types/tab";
import {
  useForceWindowControls,
  useNativeWindowControls,
  useWindowsStyleWindowControls,
} from "../settings/windowControls";
import { Button } from "@/components/motion/button";
import { libraryController, useLibraryState } from "../../player/playerStore";
import { AccountAvatar, AccountSwitcher, GoogleAccountSwitcher } from "./AccountSwitcher";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { DownloadsPanel } from "./DownloadsPanel";
import { FloatingPanel } from "./FloatingPanel";
import { NotificationsPanel } from "./NotificationsPanel";
import { useToolbarItemVisible } from "../settings/toolbarItems";
import { motion } from "motion/react";
import appIcon from "../../../assets/img/logo.svg";
import noirIcon from "../../../assets/img/logo-noir.svg";

interface TitleBarProps {
  tabs: Tab[];
  activeTabId: string;
  playingTabId: string | null;
  nonClosableTabId?: string | null;
  sidebarWidth: number;
  isHomeActive: boolean;
  onNavigateHome: () => void;
  onCreateTab: () => void;
  onCloseTab: (tabId: string) => void;
  onSwitchTab: (tabId: string) => void;
  onReorderTab: (draggedTabId: string, targetTabId: string, insertAfter: boolean) => void;
  onOpenSettings: () => void;
  onOpenDownloads?: () => void;
  onboardingFirstTabId?: string;
  /**
   * Which desktop skin is drawing this bar. Only the brand block's edge and the bar's underline
   * differ; everything that acts on the window or the account is shared, so a fix to window
   * controls or the account panel lands in both skins at once.
   */
  variant?: "glass" | "noir";
  /** Extra content between the brand block and the tabs. Noir puts history and search here. */
  leading?: ReactNode;
  /** Noir only: sits just before the centred tabs (the search button). */
  searchSlot?: ReactNode;
}

const ACCOUNT_PANEL_ITEM =
  "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-foreground transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/** macOS-style traffic lights vs Windows-style square controls. */
const WINDOW_BUTTON_BASE =
  "flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TitleBar({
  tabs,
  activeTabId,
  playingTabId,
  nonClosableTabId,
  sidebarWidth,
  isHomeActive,
  onNavigateHome,
  onCreateTab,
  onCloseTab,
  onSwitchTab,
  onReorderTab,
  onOpenSettings,
  onOpenDownloads,
  onboardingFirstTabId,
  variant = "glass",
  leading,
  searchSlot,
}: TitleBarProps) {
  const isNoir = variant === "noir";
  const appWindow = getCurrentWindow();
  const libraryState = useLibraryState();
  const account = libraryState.library?.account;
  // Confirmed by YouTube, not merely by having a library on screen — a cache with no expiry
  // will happily supply one long after the session behind it stopped working.
  const isSignedIn = libraryState.status === "ready"
    && Boolean(account)
    && libraryState.sessionConfirmedAt !== null;
  // Startup restores the session before it can say whether there is one — "Not signed in" is
  // the wrong answer while that is still happening.
  const isConnecting = !isSignedIn
    && (libraryState.status === "restoring"
      || libraryState.status === "loading"
      || libraryState.status === "authorizing");
  const [isAccountPanelOpen, setIsAccountPanelOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const nativeWindowControls = useNativeWindowControls();
  const windowsStyleWindowControls = useWindowsStyleWindowControls();
  const forceWindowControls = useForceWindowControls();
  // On Linux, window management belongs to the compositor. Tiling compositors (niri, sway,
  // hyprland, …) have no minimize at all and draw nothing, so app buttons would be dead
  // weight; desktops like GNOME/KDE get the custom buttons so close/minimize stay reachable.
  // "Show window controls" in settings overrides this for anyone who wants the buttons anyway.
  const tilingWindowManager = useSyncExternalStore(
    subscribeTilingWindowManager,
    isTilingWindowManager,
    () => false,
  );
  const showCustomWindowControls = !nativeWindowControls
    && (!isLinux || !tilingWindowManager || forceWindowControls);
  const discordEnabled = useDiscordPresenceEnabled();
  const lastFmEnabled = useLastFmScrobblingEnabled();
  const ytScrobblingEnabled = useYouTubeScrobbling();
  const notificationsVisible = useToolbarItemVisible("notifications");
  const downloadsVisible = useToolbarItemVisible("downloads");
  const discordVisible = useToolbarItemVisible("discord");
  const lastFmVisible = useToolbarItemVisible("lastfm");
  const ytMusicVisible = useToolbarItemVisible("ytmusic");
  const homePointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const suppressHomeClickRef = useRef(false);
  const hideHomeText = sidebarWidth <= 120;

  const startWindowDrag = async () => {
    try {
      window.dispatchEvent(new Event("main-window-drag-started"));

      if (await appWindow.isMaximized()) {
        await appWindow.unmaximize();
      }

      await appWindow.startDragging();
    } catch (error) {
      logInternalError("TitleBar.startWindowDrag failed", error);
    }
  };

  const handleMinimize = async () => {
    try {
      if (await appWindow.isFullscreen()) {
        await appWindow.setFullscreen(false);
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }

      await appWindow.minimize();
    } catch (error) {
      logInternalError("TitleBar.minimize failed", error);
    }
  };

  const handleToggleMaximize = async () => {
    try {
      if (await appWindow.isMaximized()) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    } catch (error) {
      logInternalError("TitleBar.maximize failed", error);
    }
  };

  const tabsNode = (
    <MusicTabs
      tabs={tabs}
      activeTabId={activeTabId}
      playingTabId={playingTabId}
      nonClosableTabId={nonClosableTabId}
      onCreateTab={onCreateTab}
      onCloseTab={onCloseTab}
      onSwitchTab={onSwitchTab}
      onReorderTab={onReorderTab}
      onboardingFirstTabId={onboardingFirstTabId}
      variant={isNoir ? "noir" : "glass"}
    />
  );

  return (
    <div
      className={cn(
        "relative z-30 flex h-[var(--titlebar-height)] shrink-0 items-stretch pt-1",
        // Noir: one hairline under the whole bar, in place of glass's divider beside the brand.
        isNoir && "border-b border-[var(--noir-hairline)] pt-0",
      )}
    >
      <button
        type="button"
        style={isNoir ? undefined : { width: `${sidebarWidth}px` }}
        className={cn(
          // The brand block: its right edge is the sidebar's divider, continued up through the
          // title bar so the left column reads as one full-height strip.
          "flex shrink-0 items-center gap-2.5 border-r border-border px-6 text-foreground transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
          isHomeActive ? "opacity-100" : "opacity-85 hover:opacity-100",
          hideHomeText && "justify-center gap-0 px-0",
          // Noir has no divider here, and the brand lines up with the sidebar's text edge.
          isNoir && "w-auto border-r-0 px-0 pl-10 pr-8",
        )}
        onClick={() => {
          if (suppressHomeClickRef.current) {
            suppressHomeClickRef.current = false;
            return;
          }
          onNavigateHome();
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          suppressHomeClickRef.current = false;
          homePointerRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const pointer = homePointerRef.current;
          if (!pointer || pointer.pointerId !== event.pointerId) return;

          const distance = Math.hypot(
            event.clientX - pointer.startX,
            event.clientY - pointer.startY,
          );
          if (distance < 5) return;

          homePointerRef.current = null;
          suppressHomeClickRef.current = true;
          void startWindowDrag();
        }}
        onPointerUp={(event) => {
          if (homePointerRef.current?.pointerId === event.pointerId) {
            homePointerRef.current = null;
          }
        }}
        onPointerCancel={() => {
          homePointerRef.current = null;
        }}
        aria-label="Home"
        aria-current={isHomeActive ? "page" : undefined}
      >
         <motion.img
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          // Noir has its own mark (red and charcoal, wider than tall), so it is sized by height.
          className={isNoir ? "h-6 w-auto" : "size-7"}
          src={isNoir ? noirIcon : appIcon}
          alt=""
        /> 
        {!hideHomeText && (
          <h3
            className={cn(
              "font-lexend text-[1.65rem] font-light leading-none tracking-[0.1em]",
              // A small wordmark, as in the design, rather than glass's large one.
              isNoir && "text-[0.95rem] font-normal tracking-[0.22em]",
            )}
          >
            WEAV
          </h3>
        )}
      </button>

      {leading}

      {isNoir ? (
        /*
          Noir centres the search button and the tabs in the bar itself, not in whatever space the
          brand and history controls leave over. The wrapper ignores the pointer so the window
          can still be dragged by the bar around it; its children opt back in.
        */
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 flex max-w-[44%] -translate-x-1/2 items-center gap-3 [&>*]:pointer-events-auto">
          {searchSlot}
          {tabsNode}
        </div>
      ) : (
        tabsNode
      )}

      <div
        className="min-w-6 flex-1"
        aria-label="Drag window"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          void startWindowDrag();
        }}
        onDoubleClick={() => void handleToggleMaximize()}
      />

      {/*
        App actions sit immediately left of the window controls, separated by a hairline so
        "things that act on the app" and "things that act on the window" stay legible as two
        groups. They render regardless of the native-controls setting, since on Linux/native
        chrome the window buttons disappear but these still belong here.
      */}
      <div className="flex shrink-0 items-center gap-1 pl-2 pr-1" aria-label="App actions">
        {/*
          Integration toggles.

          Both share what the user is listening to with a third party, which is exactly the kind
          of thing worth being able to stop in one click rather than three — hence a toolbar
          toggle rather than only a setting buried in a panel. Dimmed when off so the current
          state reads at a glance without a label.
        */}
        {notificationsVisible && (
          <NotificationsPanel signedIn={libraryState.status === "ready"} />
        )}
        {downloadsVisible && <DownloadsPanel onOpenDownloads={onOpenDownloads} />}
        {!isNoir && discordVisible && (
        <Tooltip
          side="bottom"
          content={discordEnabled ? "Discord presence on" : "Discord presence off"}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void DiscordRpcService.setEnabled(!discordEnabled)}
            aria-pressed={discordEnabled}
            aria-label={
              discordEnabled ? "Turn off Discord presence" : "Turn on Discord presence"
            }
          >
            <DiscordIcon
              size={16}
              aria-hidden="true"
              className={cn(
                "transition-opacity",
                discordEnabled ? "opacity-100 text-primary" : "opacity-40",
              )}
            />
          </Button>
        </Tooltip>
        )}
        {!isNoir && lastFmVisible && (
        <Tooltip
          side="bottom"
          content={lastFmEnabled ? "Last.fm scrobbling on" : "Last.fm scrobbling off"}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLastFmScrobblingEnabled(!lastFmEnabled)}
            aria-pressed={lastFmEnabled}
            aria-label={
              lastFmEnabled ? "Turn off Last.fm scrobbling" : "Turn on Last.fm scrobbling"
            }
          >
            <LastFmIcon
              size={16}
              aria-hidden="true"
              className={cn(
                "transition-opacity",
                lastFmEnabled ? "opacity-100 text-primary" : "opacity-40",
              )}
            />
          </Button>
        </Tooltip>
        )}
        {!isNoir && ytMusicVisible && (
        <Tooltip
          side="bottom"
          content={
            ytScrobblingEnabled
              ? "Adding plays to YouTube Music history"
              : "Not adding plays to YouTube Music history"
          }
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setYouTubeScrobbling(!ytScrobblingEnabled)}
            aria-pressed={ytScrobblingEnabled}
            aria-label={
              ytScrobblingEnabled
                ? "Stop adding plays to YouTube Music history"
                : "Add plays to YouTube Music history"
            }
          >
            <YouTubeMusicIcon
              size={16}
              aria-hidden="true"
              className={cn(
                "transition-opacity",
                ytScrobblingEnabled ? "opacity-100 text-primary" : "opacity-40",
              )}
            />
          </Button>
        </Tooltip>
        )}

        {!isNoir && (
        <Tooltip side="bottom" content="Settings">
        <Button
            variant='ghost'
          size='icon'
            
            onClick={onOpenSettings}
            aria-label="Open settings"
          >
            <SettingsIcon size={17} aria-hidden="true" />
          </Button>
        </Tooltip>
        )}

        {/* Only once signed in: an avatar that opens nothing is worse than no avatar. The
            panel is portalled because the title bar clips its children. */}
        {/* Always present, signed in or not: when signed out it is the way *in*, so hiding
            it would leave the toolbar with no account affordance at all. */}
        <FloatingPanel
          open={isAccountPanelOpen}
          onOpenChange={setIsAccountPanelOpen}
          side="bottom"
          className="w-64"
          trigger={
            <Tooltip side="bottom" content={isSignedIn ? account?.name || "Account" : "Sign in"}>
              <button
                type="button"
                onClick={() => setIsAccountPanelOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={isAccountPanelOpen}
                aria-label={isSignedIn ? `Account: ${account?.name || "YouTube Music"}` : "Sign in"}
                className={cn(
                  isNoir
                    ? "ml-1 flex h-9 items-center gap-2.5 rounded-full pr-1 transition-opacity hover:opacity-80"
                    : "ml-0.5 grid size-7 place-items-center rounded-full transition-shadow",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  !isNoir && isAccountPanelOpen && "ring-1 ring-border",
                )}
              >
                <AccountAvatar
                  artworkUrl={isSignedIn ? account?.artworkUrl : undefined}
                  className={isNoir ? "size-8" : "size-7"}
                  iconSize={15}
                />
                {isNoir && (
                  <span className="hidden max-w-[10rem] truncate text-[13px] text-muted-foreground xl:block">
                    {isSignedIn ? account?.name || "Account" : "Sign in"}
                  </span>
                )}
              </button>
            </Tooltip>
          }
        >
          {isSignedIn ? (
            <div className="flex flex-col gap-1">
              {/* Who you are, before what you can do about it: the avatar in the toolbar is
                  ambiguous on its own, and this line is the answer to the click. */}
              <div className="flex items-center gap-2.5 px-1 py-1.5">
                <AccountAvatar artworkUrl={account?.artworkUrl} className="size-9" iconSize={18} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {account?.name || "YouTube Music"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">Signed in</span>
                </span>
              </div>

              <span className="my-0.5 h-px bg-border" aria-hidden="true" />

              {/* Separate Google logins first, channels within the active one after — labeled
                  so the two are never mistaken for one undifferentiated list. This is a quick
                  switcher, not where accounts are added or removed, so a section (label
                  included) renders nothing at all when there is only one option in it. */}
              <GoogleAccountSwitcher
                libraryController={libraryController}
                onSwitched={() => setIsAccountPanelOpen(false)}
                label="Account"
              />

              <AccountSwitcher
                libraryController={libraryController}
                onSwitched={() => setIsAccountPanelOpen(false)}
                label="Channel"
              />

              <button
                type="button"
                className={ACCOUNT_PANEL_ITEM}
                onClick={() => {
                  setIsAccountPanelOpen(false);
                  onOpenSettings();
                }}
              >
                <SettingsIcon size={16} aria-hidden="true" />
                Account settings
              </button>
            </div>
          ) : (
            /*
             * Signed out, this panel is the way in, so it says what signing in gets you rather
             * than only offering a verb. The button hands off to settings because that screen
             * is where the device-code prompt is rendered — starting the flow from here would
             * put the code somewhere nobody is looking.
             */
            <div className="flex flex-col items-center gap-1 px-2 pb-2 pt-3 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
                <LoginIcon size={20} aria-hidden="true" />
              </span>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {isConnecting ? "Connecting…" : "Not signed in"}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {isConnecting
                  ? "Restoring your YouTube Music session."
                  : "Connect YouTube Music for your library, playlists and likes."}
              </p>
              <GoogleSignInButton
                className="mt-2"
                fullWidth
                isBusy={isConnecting}
                onClick={() => {
                  setIsAccountPanelOpen(false);
                  onOpenSettings();
                }}
              />
            </div>
          )}
        </FloatingPanel>

        {/*
          Noir folds the things the glass bar lays out as a row of icons — settings and the three
          sharing toggles — into one menu, as the design has a single hamburger there.
        */}
        {isNoir && (
          <FloatingPanel
            open={isMenuOpen}
            onOpenChange={setIsMenuOpen}
            side="bottom"
            className="w-64"
            trigger={
              <Tooltip side="bottom" content="Menu">
                <button
                  type="button"
                  onClick={() => setIsMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={isMenuOpen}
                  aria-label="Menu"
                  className="ml-1 grid size-9 place-items-center rounded-full text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <HamburgerMenuIcon size={20} aria-hidden="true" />
                </button>
              </Tooltip>
            }
          >
            <div className="flex flex-col gap-0.5" role="menu">
              <button
                type="button"
                role="menuitem"
                className={ACCOUNT_PANEL_ITEM}
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenSettings();
                }}
              >
                <SettingsIcon size={16} aria-hidden="true" />
                Settings
              </button>
              {onOpenDownloads && (
                <button
                  type="button"
                  role="menuitem"
                  className={ACCOUNT_PANEL_ITEM}
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenDownloads();
                  }}
                >
                  <DownloadIcon size={16} aria-hidden="true" />
                  Downloads
                </button>
              )}

              {(discordVisible || lastFmVisible || ytMusicVisible) && (
                <span className="my-1 h-px bg-border" aria-hidden="true" />
              )}
              {discordVisible && (
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={discordEnabled}
                  className={ACCOUNT_PANEL_ITEM}
                  onClick={() => void DiscordRpcService.setEnabled(!discordEnabled)}
                >
                  <DiscordIcon size={16} aria-hidden="true" />
                  <span className="flex-1">Discord presence</span>
                  <span className={cn("text-xs", discordEnabled ? "text-primary" : "text-muted-foreground")}>
                    {discordEnabled ? "On" : "Off"}
                  </span>
                </button>
              )}
              {lastFmVisible && (
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={lastFmEnabled}
                  className={ACCOUNT_PANEL_ITEM}
                  onClick={() => setLastFmScrobblingEnabled(!lastFmEnabled)}
                >
                  <LastFmIcon size={16} aria-hidden="true" />
                  <span className="flex-1">Last.fm scrobbling</span>
                  <span className={cn("text-xs", lastFmEnabled ? "text-primary" : "text-muted-foreground")}>
                    {lastFmEnabled ? "On" : "Off"}
                  </span>
                </button>
              )}
              {ytMusicVisible && (
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={ytScrobblingEnabled}
                  className={ACCOUNT_PANEL_ITEM}
                  onClick={() => setYouTubeScrobbling(!ytScrobblingEnabled)}
                >
                  <YouTubeMusicIcon size={16} aria-hidden="true" />
                  <span className="flex-1">YouTube Music history</span>
                  <span className={cn("text-xs", ytScrobblingEnabled ? "text-primary" : "text-muted-foreground")}>
                    {ytScrobblingEnabled ? "On" : "Off"}
                  </span>
                </button>
              )}
            </div>
          </FloatingPanel>
        )}
      </div>

      {showCustomWindowControls && (
        <span className="my-3 w-px shrink-0 bg-border" aria-hidden="true" />
      )}

      {showCustomWindowControls && (
        <div
          className={cn(
            "flex shrink-0 items-center",
            windowsStyleWindowControls ? "gap-0" : "gap-1.5 px-3",
          )}
          aria-label="Window controls"
        >
          <button
            type="button"
            aria-label="Minimize"
            className={cn(
              WINDOW_BUTTON_BASE,
              windowsStyleWindowControls
                ? "h-full w-12 hover:bg-card"
                : "size-3 rounded-full bg-muted-foreground/40 hover:bg-muted-foreground",
            )}
            onClick={() => void handleMinimize()}
          >
            {windowsStyleWindowControls && <span aria-hidden="true">&#8211;</span>}
          </button>
          <button
            type="button"
            aria-label="Maximize"
            className={cn(
              WINDOW_BUTTON_BASE,
              windowsStyleWindowControls
                ? "h-full w-12 hover:bg-card"
                : "size-3 rounded-full bg-muted-foreground/40 hover:bg-muted-foreground",
            )}
            onClick={() => void handleToggleMaximize()}
          >
            {windowsStyleWindowControls && <span aria-hidden="true">□</span>}
          </button>
          <button
            type="button"
            aria-label="Close"
            className={cn(
              WINDOW_BUTTON_BASE,
              windowsStyleWindowControls
                ? "h-full w-12 hover:bg-destructive hover:text-destructive-foreground"
                : "size-3 rounded-full bg-muted-foreground/40 hover:bg-primary",
            )}
            onClick={() => {
              logInternalInfo("TitleBar.close clicked");
              void invoke("quit_app")
                .then(() => {
                  logInternalInfo("TitleBar.close quit_app invoked");
                })
                .catch((error) => {
                  logInternalError("TitleBar.close quit_app failed", error);
                  logInternalWarn("TitleBar.close fallback to appWindow.close");
                  void appWindow.close();
                });
            }}
          >
            {windowsStyleWindowControls && <span aria-hidden="true">&#10005;</span>}
          </button>
        </div>
      )}
    </div>
  );
}
