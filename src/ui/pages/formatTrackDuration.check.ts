/**
 * Self-check for the phone track-row duration label. No test runner in this project, so:
 *
 *   npm run check
 *
 * An unknown length has to read as nothing, not "0:00" — most playlist entries arrive without
 * one — and rounding has to carry into the minute rather than print "0:60".
 */
export {};

import { formatTrackDuration } from "./formatTrackDuration";

function equal(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`FAILED: ${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

// --- unknown lengths read as nothing ----------------------------------------------------

equal(formatTrackDuration(undefined), "", "undefined");
equal(formatTrackDuration(0), "", "zero");
equal(formatTrackDuration(-5), "", "negative");
equal(formatTrackDuration(Number.NaN), "", "NaN");
equal(formatTrackDuration(Number.POSITIVE_INFINITY), "", "infinity");

// --- minutes and seconds ----------------------------------------------------------------

equal(formatTrackDuration(1), "0:01", "one second");
equal(formatTrackDuration(59), "0:59", "under a minute");
equal(formatTrackDuration(60), "1:00", "exactly a minute");
equal(formatTrackDuration(187), "3:07", "seconds are zero-padded");
equal(formatTrackDuration(600), "10:00", "double-digit minutes");

// --- rounding carries instead of printing 0:60 ------------------------------------------

equal(formatTrackDuration(59.6), "1:00", "59.6s rounds up into the next minute");
equal(formatTrackDuration(187.4), "3:07", "rounds down below .5");
equal(formatTrackDuration(3599.6), "1:00:00", "rounding carries into the hour");

// --- hours ------------------------------------------------------------------------------

equal(formatTrackDuration(3600), "1:00:00", "exactly an hour");
equal(formatTrackDuration(3725), "1:02:05", "hours, padded minutes and seconds");

console.log("formatTrackDuration.check: ok");
