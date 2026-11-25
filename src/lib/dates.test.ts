import {
  compareIsoDate,
  formatDisplayDate,
  isValidIsoDate,
  parseIsoDate,
  todayIso,
  toIsoDate,
} from './dates';

describe('dates', () => {
  it('formats using local calendar fields, not UTC', () => {
    // 1 Jan 2026 00:30 local — a UTC conversion in a negative-offset zone would say 2025-12-31.
    const local = new Date(2026, 0, 1, 0, 30, 0);
    expect(toIsoDate(local)).toBe('2026-01-01');
    expect(todayIso(local)).toBe('2026-01-01');
  });

  it('rejects impossible or malformed dates', () => {
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('24-11-2026')).toBe(false);
    expect(isValidIsoDate('2026-2-1')).toBe(false);
    expect(isValidIsoDate('2024-02-29')).toBe(true);
  });

  it('parses to local midnight', () => {
    const parsed = parseIsoDate('2026-11-24');
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(10);
    expect(parsed?.getDate()).toBe(24);
    expect(parsed?.getHours()).toBe(0);
    expect(parseIsoDate('nope')).toBeNull();
  });

  it('compares lexicographically for ordering', () => {
    expect(compareIsoDate('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareIsoDate('2026-02-01', '2026-01-31')).toBe(1);
    expect(compareIsoDate('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('renders dates as DD/MM/YYYY for the user', () => {
    expect(formatDisplayDate('2026-11-24')).toBe('24/11/2026');
  });

  it('zero-pads single-digit days and months', () => {
    expect(formatDisplayDate('2026-01-05')).toBe('05/01/2026');
    expect(formatDisplayDate('2026-12-31')).toBe('31/12/2026');
  });

  it('returns invalid input unchanged so it is visible, not silently blanked', () => {
    expect(formatDisplayDate('not-a-date')).toBe('not-a-date');
    expect(formatDisplayDate('2026-02-30')).toBe('2026-02-30');
    expect(formatDisplayDate('')).toBe('');
  });

  it('does not depend on the device locale', () => {
    // Formatting is string-based, so a locale change cannot alter the output.
    expect(formatDisplayDate('2026-03-09')).toBe('09/03/2026');
  });
});
