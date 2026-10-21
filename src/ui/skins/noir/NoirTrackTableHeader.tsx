import { useTranslation } from "react-i18next";
import { useAppSkin } from "../../settings/appSkin";

/**
 * Width of everything a track row reserves after its last text column: the rating pair (64px),
 * the download toggle (32px) and the two quick-add buttons (64px), plus the three 12px gaps that
 * separate them. Those controls are invisible until hover but they still take space, so the
 * heading row has to reserve the same width for its columns to land over the row's.
 */
const ROW_ACTIONS_WIDTH = 196;

/**
 * The column headings above a track list: `#`, Title and (where the list shows one) Album.
 *
 * Renders nothing under the glass skin, so adding it to a page changes nothing there. Under Noir
 * it mirrors `TrackRow`'s own flex structure cell for cell — index, artwork, title, album, actions
 * — rather than using a grid of its own, so the headings track the rows however wide the window is.
 *
 * Decorative (`aria-hidden`): the rows are buttons, not a table, and announcing "Title, Album" in
 * front of a list that has no table semantics would only mislead.
 */
export function NoirTrackTableHeader({ showAlbum = false }: { showAlbum?: boolean }) {
  const { t } = useTranslation();
  if (useAppSkin() !== "noir") return null;

  return (
    <div
      className="noir-table-head mb-1 flex items-center gap-3 px-3 pb-3 text-[11px] font-semibold tracking-wide text-foreground"
      aria-hidden="true"
    >
      <span className="w-6 shrink-0 text-right">#</span>
      <span className="size-10 shrink-0" />
      <span className="min-w-0 flex-1">{t("noir.title", "Title")}</span>
      {showAlbum && (
        <span className="hidden min-w-0 flex-1 basis-0 lg:block">{t("noir.album", "Album")}</span>
      )}
      <span className="shrink-0" style={{ width: ROW_ACTIONS_WIDTH }} />
    </div>
  );
}
