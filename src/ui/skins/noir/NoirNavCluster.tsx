import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ArrowLeftIcon, ArrowRightIcon, SearchIcon } from "@/ui/icons";
import type { Tab } from "../../types/tab";

interface NoirNavClusterProps {
  activeTab: Tab | undefined;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onOpenSearch: () => void;
}

const ICON_BUTTON =
  "grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors " +
  "hover:text-foreground disabled:pointer-events-none disabled:opacity-30 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * What sits between Noir's brand mark and the tabs: history, a breadcrumb for where you are, and
 * search. Together they replace the glass sidebar's search field and the back/forward row that
 * used to float above the page.
 *
 * The breadcrumb is read from the active tab rather than tracked separately, so it can never
 * disagree with what the page is showing.
 */
export function NoirNavCluster({
  activeTab,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onOpenSearch,
}: NoirNavClusterProps) {
  const { t } = useTranslation();

  let section: string | undefined;
  let title: string | undefined;
  switch (activeTab?.view) {
    case "playlist":
      section = t("sidebar.playlists");
      title = activeTab.playlist?.title ?? activeTab.title;
      break;
    case "album":
      section = t("sidebar.albums");
      title = activeTab.album?.title ?? activeTab.title;
      break;
    case "artist":
      section = t("sidebar.artists");
      title = activeTab.artist?.name ?? activeTab.title;
      break;
    case "search":
      section = t("sidebar.search");
      title = activeTab.searchQuery;
      break;
    case "related":
      section = t("noir.related", "Related");
      title = activeTab.relatedTrack?.title;
      break;
    case "home":
      section = t("sidebar.home");
      break;
    case "browse":
      section = activeTab.browseTab === "downloads" ? t("common.downloads") : t("sidebar.browse");
      break;
    case "library":
      section = t("sidebar.library");
      break;
    case "history":
      section = t("sidebar.history");
      break;
    case "settings":
      section = t("sidebar.settings");
      break;
    default:
      break;
  }

  return (
    <div className="mr-3 flex min-w-0 shrink items-center gap-1" aria-label="Navigation">
      <button
        type="button"
        className={ICON_BUTTON}
        onClick={onBack}
        disabled={!canGoBack}
        aria-label={t("noir.back", "Go back")}
      >
        <ArrowLeftIcon size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={cn(ICON_BUTTON, "max-lg:hidden")}
        onClick={onForward}
        disabled={!canGoForward}
        aria-label={t("noir.forward", "Go forward")}
      >
        <ArrowRightIcon size={18} aria-hidden="true" />
      </button>

      {section && (
        <nav
          aria-label="Breadcrumb"
          className="ml-1 flex min-w-0 items-center gap-2 text-[13px] max-xl:hidden"
        >
          <span className="shrink-0 text-muted-foreground">{section}</span>
          {title && (
            <>
              <span aria-hidden="true" className="shrink-0 text-muted-foreground/60">
                ›
              </span>
              <span className="max-w-[16rem] truncate font-medium text-foreground" title={title}>
                {title}
              </span>
            </>
          )}
        </nav>
      )}

      <button
        type="button"
        className={cn(ICON_BUTTON, "ml-1")}
        onClick={onOpenSearch}
        aria-label={t("sidebar.search")}
      >
        <SearchIcon size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
