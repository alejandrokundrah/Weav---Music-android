import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import type { TabView } from "../types/tab";
import { NavExploreIcon, NavHomeIcon, NavPlayIcon, NavUserIcon } from "./phone/PhoneIcons";

interface MobileNavProps {
  activeView: TabView | undefined;
  onHome: () => void;
  onLibrary: () => void;
  onBrowse: () => void;
  onSettings: () => void;
}

interface NavItem {
  key: string;
  label: string;
  Icon: ComponentType<{ active?: boolean }>;
  active: boolean;
  onPress: () => void;
}

/**
 * The phone's bottom bar: four places, icons only, on a flat #1B1B1B strip.
 *
 * The current page is the one drawn in a white gradient instead of grey, with a small lit tab
 * hanging from the top edge above it. Search is not here — it lives in the Home header — and
 * the account page is reached through the person icon, which opens Settings.
 */
export function MobileNav({ activeView, onHome, onLibrary, onBrowse, onSettings }: MobileNavProps) {
  const items: NavItem[] = [
    { key: "home", label: "Home", Icon: NavHomeIcon, active: activeView === "home", onPress: onHome },
    { key: "browse", label: "Browse", Icon: NavExploreIcon, active: activeView === "browse", onPress: onBrowse },
    { key: "library", label: "Library", Icon: NavPlayIcon, active: activeView === "library", onPress: onLibrary },
    { key: "settings", label: "Settings", Icon: NavUserIcon, active: activeView === "settings", onPress: onSettings },
  ];
  const activeIndex = items.findIndex((item) => item.active);

  return (
    <nav
      aria-label="Main"
      className="relative shrink-0 overflow-hidden rounded-t-[2px] bg-[#1b1b1b] pb-[max(env(safe-area-inset-bottom),1.25rem)]"
    >
      {/* The lit tab. Positioned by column so it slides between items rather than blinking. */}
      {activeIndex >= 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 h-1.5 w-[58px] rounded-b-md bg-gradient-to-t from-white to-white/90 shadow-[0_4px_20px_rgba(255,255,255,0.4)] transition-[left] duration-300 ease-out"
          style={{ left: `calc(0.625rem + (100% - 1.25rem) * ${(activeIndex + 0.5) / items.length} - 29px)` }}
        />
      )}
      <div className="grid grid-cols-4 px-2.5 pt-[11px]">
        {items.map(({ key, label, Icon, active, onPress }) => (
          <button
            key={key}
            type="button"
            onClick={onPress}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-12 items-center justify-center rounded-2xl transition-transform active:scale-90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
            )}
          >
            <Icon active={active} />
          </button>
        ))}
      </div>
    </nav>
  );
}
