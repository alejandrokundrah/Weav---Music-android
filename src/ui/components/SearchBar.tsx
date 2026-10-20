import { Button } from "@/components/motion/button";
import { Tooltip } from "@/components/motion/tooltip";
import { ArrowLeftIcon, ArrowRightIcon, SearchIcon } from "@/ui/icons";
import { primaryModifierLabel } from "../platform";

interface SearchBarProps {
  onOpen: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  /**
   * Desktop: only the back / forward arrows. The search field moved into the sidebar, so
   * rendering it here as well would be two doors to the same room.
   */
  navigationOnly?: boolean;
}

export function SearchBar({
  onOpen,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  navigationOnly = false,
}: SearchBarProps) {
  const showBackButton = canGoBack || canGoForward;

  return (
    <div className={navigationOnly ? "flex items-center gap-1" : "flex items-center gap-2 max-w-3xl mx-auto"}>
      {showBackButton && (
        <Tooltip content="Back">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            disabled={!canGoBack}
            aria-label="Go back"
            className="shrink-0 rounded-full"
          >
            <ArrowLeftIcon size={18} aria-hidden="true" />
          </Button>
        </Tooltip>
      )}
      {canGoForward && (
        <Tooltip content="Forward">
          <Button
            variant="ghost"
            size="icon"
            onClick={onForward}
            aria-label="Go forward"
            className="shrink-0 rounded-full"
          >
            <ArrowRightIcon size={18} aria-hidden="true" />
          </Button>
        </Tooltip>
      )}

      {!navigationOnly && (
      <button
        type="button"
        onClick={onOpen}
        data-onboarding="search"
        className="group flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-card px-3.5 text-left text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-md:font-lexend max-md:h-11 max-md:bg-[#1b1b1b] max-md:px-4 max-md:font-extralight max-md:text-[#929292]"
      >
        <SearchIcon size={17} className="shrink-0" />
        <span className="truncate max-md:hidden">Search artists, songs, playlists, and albums</span>
        <span className="truncate md:hidden">Songs, artists, albums</span>
        <kbd className="ml-auto max-md:hidden shrink-0 rounded bg-background/60 px-1.5 py-0.5 font-sans text-xs text-muted-foreground">
          {primaryModifierLabel} Space
        </kbd>
      </button>
      )}
    </div>
  );
}
