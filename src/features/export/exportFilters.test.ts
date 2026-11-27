import { todayIso, toIsoDate } from '@/lib/dates';

import { isInvalidRange, periodBounds, periodFromStoredPreferences } from './exportFilters';

describe('periodBounds', () => {
  const now = new Date(2026, 10, 27); // 27 November 2026, local calendar.

  it('returns no bounds for all time', () => {
    expect(periodBounds({ period: 'all', from: '', to: '' }, now)).toEqual({});
  });

  it('returns the last 30 days inclusive of today', () => {
    expect(periodBounds({ period: '30d', from: '', to: '' }, now)).toEqual({
      from: '2026-10-28',
      to: '2026-11-27',
    });
  });

  it('returns the last 6 months inclusive of today', () => {
    expect(periodBounds({ period: '6m', from: '', to: '' }, now)).toEqual({
      from: '2026-05-27',
      to: '2026-11-27',
    });
  });

  it('crosses a year boundary without going through UTC', () => {
    expect(periodBounds({ period: '6m', from: '', to: '' }, new Date(2026, 1, 15))).toEqual({
      from: '2025-08-15',
      to: '2026-02-15',
    });
  });

  it('passes a custom range through, including one open end', () => {
    expect(periodBounds({ period: 'custom', from: '2025-01-01', to: '2025-12-31' }, now)).toEqual({
      from: '2025-01-01',
      to: '2025-12-31',
    });
    expect(periodBounds({ period: 'custom', from: '2025-01-01', to: '' }, now)).toEqual({
      from: '2025-01-01',
    });
  });
});

describe('isInvalidRange', () => {
  it('is only true when both bounds exist and are reversed', () => {
    expect(isInvalidRange('2026-01-02', '2026-01-01')).toBe(true);
    expect(isInvalidRange('2026-01-01', '2026-01-01')).toBe(false);
    expect(isInvalidRange('2026-01-01', '2026-01-02')).toBe(false);
    expect(isInvalidRange(undefined, '2026-01-01')).toBe(false);
    expect(isInvalidRange('2026-01-01', undefined)).toBe(false);
  });
});

describe('periodFromStoredPreferences', () => {
  it('shows "all time" when nothing was stored and "custom" otherwise', () => {
    expect(periodFromStoredPreferences(null, null)).toBe('all');
    expect(periodFromStoredPreferences('2026-01-01', null)).toBe('custom');
    expect(periodFromStoredPreferences(null, '2026-01-01')).toBe('custom');
    expect(periodFromStoredPreferences('2026-01-01', '2026-12-31')).toBe('custom');
  });
});

describe('the date helpers the presets rely on', () => {
  it('never emits a UTC-shifted day', () => {
    expect(todayIso(new Date(2026, 10, 27, 23, 30))).toBe('2026-11-27');
    expect(toIsoDate(new Date(2026, 0, 1, 0, 15))).toBe('2026-01-01');
  });
});
