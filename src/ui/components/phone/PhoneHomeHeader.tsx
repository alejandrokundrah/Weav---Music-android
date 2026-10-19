import { AccountAvatar } from "../AccountSwitcher";
import { DownloadsPanel } from "../DownloadsPanel";
import { PhoneSearchIcon } from "./PhoneIcons";

/**
 * The phone Home's top row: profile picture with a lime ring, the greeting over the person's
 * name, and search and downloads on the right.
 *
 * Presentational only. `PhoneHome` decides what the greeting says and whose name it is; this
 * draws it. The page runs edge to edge, so the row's own 20px gutters are the design's, and the
 * carousels below it pull back out of them.
 */
export function PhoneHomeHeader({
  greeting,
  name,
  avatarUrl,
  onOpenSearch,
  onOpenDownloads,
}: {
  greeting: string;
  name: string;
  avatarUrl?: string;
  onOpenSearch: () => void;
  onOpenDownloads: () => void;
}) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex min-w-0 items-center gap-1">
        {/* 50px including its 1px ring, which is how the design draws it. */}
        <span className="grid size-[50px] shrink-0 place-items-center rounded-full border border-[#adf106]">
          <AccountAvatar artworkUrl={avatarUrl} className="size-12" iconSize={22} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-base font-light leading-[18px] text-[#cdcdcd]">{greeting}</span>
          {/* `tracking-normal`: the base h1 rule adds negative tracking and a 700 weight that
              the design does not have. Medium is fitted, not eyeballed: against the design's
              glyphs 500 matches the ink area to 2%, where semibold is 9% heavy. */}
          <h1 className="truncate text-[22px] font-medium leading-[22px] tracking-normal text-white">
            {name}
          </h1>
        </div>
      </div>

      {/* The design sets these a few pixels below the avatar's centre line, in line with the
          name rather than with the whole block. */}
      <div className="mr-px flex shrink-0 translate-y-[6.6px] items-center text-[#e7e7e7]">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search"
          className="grid size-10 place-items-center rounded-full transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <PhoneSearchIcon />
        </button>
        <DownloadsPanel variant="phone" onOpenDownloads={onOpenDownloads} />
      </div>
    </header>
  );
}
