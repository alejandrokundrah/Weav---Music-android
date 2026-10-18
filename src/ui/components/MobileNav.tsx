import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import {
  CompassIcon,
  HomeActiveIcon,
  HomeIcon,
  MusicNoteActiveIcon,
  MusicNoteIcon,
  SearchIcon,
  SettingsActiveIcon,
  SettingsIcon,
} from "@/ui/icons";
import type { TabView } from "../types/tab";

interface MobileNavProps {
  activeView: TabView | undefined;
  onHome: () => void;
  onSearch: () => void;
  onLibrary: () => void;
  onBrowse: () => void;
  onSettings: () => void;
}

type IconComponent = ComponentType<{ size?: number | string; className?: string }>;

interface NavItem {
  key: string;
  label: string;
  Icon: IconComponent;
  ActiveIcon: IconComponent;
  active: boolean;
  onPress: () => void;
}

/**
 * The phone replacement for the desktop title bar and library rail: the five places the app
 * actually has, one thumb-width apart at the bottom of the screen.
 */
export function MobileNav({
  activeView,
  onHome,
  onSearch,
  onLibrary,
  onBrowse,
  onSettings,
}: MobileNavProps) {
  const items: NavItem[] = [
    { key: "home", label: "Home", Icon: HomeIcon, ActiveIcon: HomeActiveIcon, active: activeView === "home", onPress: onHome },
    { key: "search", label: "Search", Icon: SearchIcon, ActiveIcon: SearchIcon, active: activeView === "search", onPress: onSearch },
    { key: "library", label: "Library", Icon: MusicNoteIcon, ActiveIcon: MusicNoteActiveIcon, active: activeView === "library", onPress: onLibrary },
    { key: "browse", label: "Browse", Icon: CompassIcon, ActiveIcon: CompassIcon, active: activeView === "browse", onPress: onBrowse },
    { key: "settings", label: "Settings", Icon: SettingsIcon, ActiveIcon: SettingsActiveIcon, active: activeView === "settings", onPress: onSettings },
  ];

  return (
    <nav
      aria-label="Main"
      className="shrink-0 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1"
    >
      {/* A floating pill: icons only, the current page marked by a lime disc. */}
      <div className="mx-auto flex max-w-sm items-center justify-between rounded-full bg-card p-1.5 shadow-lg ring-1 ring-white/10">
        {items.map(({ key, label, Icon, ActiveIcon, active, onPress }) => {
          const Glyph = active ? ActiveIcon : Icon;
          return (
            <button
              key={key}
              type="button"
              onClick={onPress}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex size-12 items-center justify-center rounded-full transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <Glyph size={22} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
