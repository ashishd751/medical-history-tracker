/**
 * The export screen's period presets (Phase 4).
 *
 * Kept out of the component so the date arithmetic — the part that is easy to get wrong at a month
 * boundary — can be tested against a fixed clock. Bounds are inclusive `YYYY-MM-DD` strings, the
 * same shape the repository filters take.
 */
import { todayIso, toIsoDate } from '@/lib/dates';

export type ExportPeriod = 'all' | '30d' | '6m' | 'custom';

export interface ExportPeriodInput {
  readonly period: ExportPeriod;
  /** `YYYY-MM-DD`; only read for `custom`. */
  readonly from: string;
  readonly to: string;
}

export interface ExportBounds {
  readonly from?: string;
  readonly to?: string;
}

/** Inclusive bounds for a preset, computed on the device's local calendar (never UTC). */
export function periodBounds(input: ExportPeriodInput, now: Date = new Date()): ExportBounds {
  if (input.period === 'all') return {};
  if (input.period === 'custom') {
    return {
      ...(input.from ? { from: input.from } : {}),
      ...(input.to ? { to: input.to } : {}),
    };
  }
  const today = todayIso(now);
  if (input.period === '30d') {
    return {
      from: toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)),
      to: today,
    };
  }
  return {
    from: toIsoDate(new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())),
    to: today,
  };
}

/** A range the user typed backwards. The count is meaningless, so generation is disabled. */
export function isInvalidRange(from: string | undefined, to: string | undefined): boolean {
  return from !== undefined && to !== undefined && from > to;
}

/**
 * The period to show for the dates remembered from last time.
 *
 * Only the two dates are stored, not the preset, so a relaunch shows the exact same range as
 * "Custom" rather than recomputing "last 30 days" against a new today (ADR-050).
 */
export function periodFromStoredPreferences(from: string | null, to: string | null): ExportPeriod {
  return from === null && to === null ? 'all' : 'custom';
}
