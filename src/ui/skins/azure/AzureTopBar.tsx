import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useLibraryState } from "../../../player/playerStore";
import { NotificationsPanel } from "../../components/NotificationsPanel";
import type { Tab } from "../../types/tab";
import { AzureChevronLeftIcon, AzureChevronRightIcon, AzureSearchIcon } from "./azureIcons";

interface AzureTopBarProps {
  activeTab: Tab | undefined;
  canGoBack: boolean;
  onBack: () => void;
  onHome: () => void;
  onOpenSearch: () => void;
}

const ROUND_BUTTON =
  "grid size-12 shrink-0 place-items-center rounded-full bg-[var(--azure-panel)] text-white transition-colors " +
  "hover:bg-[#2c2c2c] disabled:pointer-events-none disabled:opacity-40 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The strip above Azure's page: a round back button, a `Home › Where you are` breadcrumb, the
 * search field and the notifications bell.
 *
 * The breadcrumb is read from the active tab rather than tracked separately, so it can never
 * disagree with what the page is showing. The search field is a button that opens the same
 * search overlay the other skins use, so there is one search implementation, not two.
 */
export function AzureTopBar({ activeTab, canGoBack, onBack, onHome, onOpenSearch }: AzureTopBarProps) {
  const { t } = useTranslation();
  const libraryState = useLibraryState();

  let title: string | undefined;
  switch (activeTab?.view) {
    case "playlist":
      title = activeTab.playlist?.title ?? activeTab.title;
      break;
    case "album":
      title = activeTab.album?.title ?? activeTab.title;
      break;
    case "artist":
      title = activeTab.artist?.name ?? activeTab.title;
      break;
    case "search":
      title = activeTab.searchQuery || t("sidebar.search");
      break;
    case "related":
      title = activeTab.relatedTrack?.title ?? t("noir.related", "Related");
      break;
    case "browse":
      title = activeTab.browseTab === "downloads" ? t("common.downloads") : t("sidebar.browse");
      break;
    case "library":
      title = t("sidebar.library");
      break;
    case "history":
      title = t("sidebar.history");
      break;
    case "settings":
      title = t("sidebar.settings");
      break;
    default:
      break;
  }

  return (
    <div className="relative z-10 flex h-[112px] shrink-0 items-center gap-6 px-8" aria-label="Navigation">
      <button
        type="button"
        className={ROUND_BUTTON}
        onClick={onBack}
        disabled={!canGoBack}
        aria-label={t("noir.back", "Go back")}
      >
        <AzureChevronLeftIcon size={20} />
      </button>

      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 shrink items-center gap-3 text-base max-xl:hidden"
      >
        <button
          type="button"
          onClick={onHome}
          className={cn(
            "shrink-0 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            title ? "text-[var(--azure-muted)] hover:text-white" : "text-white",
          )}
        >
          {t("sidebar.home")}
        </button>
        {title && (
          <>
            <AzureChevronRightIcon size={10} className="shrink-0 text-white" />
            <span className="max-w-[14rem] truncate text-white" title={title}>
              {title}
            </span>
          </>
        )}
      </nav>

      <button
        type="button"
        onClick={onOpenSearch}
        aria-label={t("sidebar.search")}
        className="mx-auto flex h-12 w-full max-w-[386px] min-w-0 items-center gap-3.5 rounded-full bg-[var(--azure-panel)] px-5 text-left text-base text-[var(--azure-muted)] transition-colors hover:bg-[#2c2c2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <AzureSearchIcon size={20} className="shrink-0 text-white" />
        <span className="truncate">{t("azure.searchPlaceholder", "Search music, artist, albums...")}</span>
      </button>

      <NotificationsPanel variant="azure" signedIn={libraryState.status === "ready"} />
    </div>
  );
}
