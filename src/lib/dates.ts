/**
 * Date helpers.
 *
 * Dates without time are `YYYY-MM-DD` strings in the *device's* local calendar.
 * Never round-trip them through `Date` in UTC: that shifts the day across timezones
 * and is exactly the bug the spec warns about (section 9).
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  // Reject impossible days such as 2026-02-30.
  const probe = new Date(year, month - 1, day);
  return probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === day;
}

/** Formats a Date as `YYYY-MM-DD` using local calendar fields. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear().toString().padStart(4, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today in the device's local calendar. */
export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

/** Lexicographic comparison is correct for zero-padded ISO dates. */
export function compareIsoDate(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Parses `YYYY-MM-DD` into a Date at local midnight, or null when invalid. */
export function parseIsoDate(value: string): Date | null {
  if (!isValidIsoDate(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

/** Human-readable date for display only, e.g. "24 Nov 2026". */
/**
 * Renders a stored `YYYY-MM-DD` date for the user as `DD/MM/YYYY`.
 *
 * Formatting is done on the string, not through `Date` + `toLocaleDateString`, so the
 * output is identical on every device regardless of locale settings — the UI must show
 * dates the same way on Android and iOS (section 15.1). Invalid input is returned
 * unchanged so a bad value is visible rather than silently blanked.
 */
export function formatDisplayDate(value: string): string {
  const match = ISO_DATE.exec(value);
  if (!match || !isValidIsoDate(value)) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}
