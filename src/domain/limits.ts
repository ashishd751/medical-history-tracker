/**
 * Plausibility ranges.
 *
 * These stop obvious typos (a 1700 cm height, a 12 kg weight) at the form boundary without
 * pretending to be clinical limits. They are shared by the Zod schemas so the same numbers
 * apply on every screen.
 */

export interface NumericRange {
  readonly min: number;
  readonly max: number;
}

export const HEIGHT_CM_RANGE: NumericRange = { min: 30, max: 275 };
export const WEIGHT_KG_RANGE: NumericRange = { min: 1, max: 400 };
export const BMI_DISPLAY_RANGE: NumericRange = { min: 5, max: 80 };

export const SYSTOLIC_RANGE: NumericRange = { min: 50, max: 300 };
export const DIASTOLIC_RANGE: NumericRange = { min: 20, max: 200 };

export const PULSE_RANGE: NumericRange = { min: 20, max: 250 };
/** Body temperature in Celsius; covers hypothermia through high fever. */
export const TEMPERATURE_C_RANGE: NumericRange = { min: 30, max: 45 };
export const SPO2_RANGE: NumericRange = { min: 50, max: 100 };
export const GLUCOSE_RANGE: NumericRange = { min: 10, max: 900 };

/** Free-text fields are capped so one paste cannot bloat a row or a backup. */
export const MAX_SHORT_TEXT = 200;
export const MAX_LONG_TEXT = 4000;
export const MAX_NAME = 120;

export function inRange(value: number, range: NumericRange): boolean {
  return Number.isFinite(value) && value >= range.min && value <= range.max;
}
