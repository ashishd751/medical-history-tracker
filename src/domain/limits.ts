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

/**
 * Attachment limits (Phase 2).
 *
 * A record is one visit, examination or test result; ten files is already more than a paper folder
 * holds, and it keeps a record's detail screen scrollable. PDFs keep their original bytes, so their
 * cap is about the storage a family phone can spare; images are re-encoded and get a larger source
 * cap because a modern phone photo is routinely 5–15 MB before processing.
 */
export const MAX_ATTACHMENTS_PER_RECORD = 10;
export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_SOURCE_BYTES = 40 * 1024 * 1024;

/** Long side of a stored image, and of its thumbnail. */
export const IMAGE_MAX_LONG_EDGE = 2000;
export const THUMB_MAX_LONG_EDGE = 400;
/** JPEG quality. At 2000 px this lands well under the 1.5 MB target for a typical page. */
export const IMAGE_JPEG_QUALITY = 0.8;

export function inRange(value: number, range: NumericRange): boolean {
  return Number.isFinite(value) && value >= range.min && value <= range.max;
}
