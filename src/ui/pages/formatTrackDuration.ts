/**
 * "3:07", or "1:02:05" past an hour. Empty when the length is unknown.
 *
 * Empty rather than "0:00" because YouTube omits `durationSec` on most playlist entries (see
 * `formatCollectionMeta`): a row that reads "0:00" claims the song has no length, while a row
 * with nothing on the right simply has not been told one.
 */
export function formatTrackDuration(durationSec: number | undefined): string {
  if (durationSec === undefined || !Number.isFinite(durationSec) || durationSec <= 0) return "";

  const total = Math.round(durationSec);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}
