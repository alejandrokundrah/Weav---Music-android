import { useTranslation } from "react-i18next";
import { ClockIcon } from "@/ui/icons";
import { useAppSkin } from "../../settings/appSkin";
import { NOIR_ROW_TAIL_WIDTH } from "../../components/TrackRow";

/** The heart (32px) and "more" (32px) buttons and one 4px gap sit either side of a row's length. */
const TAIL_CONTROL_AND_GAP = 36;

/**
 * The column headings above a track list: `# Title`, Album (where the list shows one) and a clock
 * over the lengths.
 *
 * Renders nothing under the glass skin, so adding it to a page changes nothing there. Under Noir
 * it mirrors `TrackRow`'s own flex structure cell for cell — play glyph, artwork, title, album,
 * tail — rather than using a grid of its own, so the headings track the rows however wide the
 * window is.
 *
 * Decorative (`aria-hidden`): the rows are buttons, not a table, and announcing "Title, Album" in
 * front of a list that has no table semantics would only mislead.
 */
export function NoirTrackTableHeader({ showAlbum = false }: { showAlbum?: boolean }) {
  const { t } = useTranslation();
  if (useAppSkin() !== "noir") return null;

  return (
    <div
      className="noir-table-head mb-1 flex items-center gap-3 px-3 pb-4 pt-1 text-[11px] font-semibold tracking-wide text-foreground"
      aria-hidden="true"
    >
      {/* Over the play glyph. */}
      <span className="w-6 shrink-0" />
      {/* "# Title" starts where the artwork does; the cell keeps the artwork's width so every
          column after it lands where the row's does. */}
      <span className="relative size-10 shrink-0">
        <span className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center gap-2.5 whitespace-nowrap">
          <span>#</span>
          <span>{t("noir.title", "Title")}</span>
        </span>
      </span>
      <span className="min-w-0 flex-1" />
      {showAlbum && (
        <span className="hidden min-w-0 flex-1 basis-0 text-center lg:block">
          {t("noir.album", "Album")}
        </span>
      )}
      <span className="flex shrink-0 justify-end" style={{ width: NOIR_ROW_TAIL_WIDTH }}>
        <span
          className="flex w-10 justify-end text-muted-foreground"
          style={{ marginRight: TAIL_CONTROL_AND_GAP }}
          title={t("noir.length", "Length")}
        >
          <ClockIcon size={14} />
        </span>
      </span>
    </div>
  );
}
