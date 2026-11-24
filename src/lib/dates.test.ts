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

  it('renders a display date and falls back to the raw value', () => {
    expect(formatDisplayDate('2026-11-24')).toBe('24 Nov 2026');
    expect(formatDisplayDate('not-a-date')).toBe('not-a-date');
  });
});
