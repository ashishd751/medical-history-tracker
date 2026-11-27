/**
 * The "Add measurement" form's strings → the repository's metric input.
 *
 * Kept out of the screen so the unit conversion and the plausibility ranges can be tested without
 * rendering anything. Every value is converted to metric *before* it is range-checked, so a 154 lb
 * weight is validated as 69.9 kg rather than against a kilogram limit (section 9).
 */
import {
  DIASTOLIC_RANGE,
  fahrenheitToCelsius,
  GLUCOSE_RANGE,
  HEIGHT_CM_RANGE,
  inRange,
  inToCm,
  lbToKg,
  type MeasurementKind,
  type NumericRange,
  PULSE_RANGE,
  roundTo,
  SPO2_RANGE,
  SYSTOLIC_RANGE,
  TEMPERATURE_C_RANGE,
  type UnitSystem,
  WEIGHT_KG_RANGE,
} from '@/domain';
import { isValidIsoDate } from '@/lib/dates';

export interface MeasurementDraft {
  readonly kind: MeasurementKind;
  readonly value1: string;
  readonly value2: string;
  /** `YYYY-MM-DD`; defaults to today when the sheet opens. */
  readonly measuredOn: string;
}

export interface MeasurementSubmission {
  readonly kind: MeasurementKind;
  readonly v1: number;
  readonly v2: number | null;
  readonly measuredOn: string;
}

export type MeasurementDraftError = 'value' | 'date';

export type MeasurementDraftResult =
  | { readonly ok: true; readonly submission: MeasurementSubmission }
  | { readonly ok: false; readonly error: MeasurementDraftError };

const RANGES: Record<Exclude<MeasurementKind, 'bp'>, NumericRange> = {
  height: HEIGHT_CM_RANGE,
  weight: WEIGHT_KG_RANGE,
  pulse: PULSE_RANGE,
  temperature: TEMPERATURE_C_RANGE,
  spo2: SPO2_RANGE,
  glucose: GLUCOSE_RANGE,
};

/** Converts a value the user typed in their display units into the stored metric value. */
export function toMetric(kind: MeasurementKind, value: number, unitSystem: UnitSystem): number {
  if (unitSystem === 'metric') return value;
  switch (kind) {
    case 'height':
      return roundTo(inToCm(value), 1);
    case 'weight':
      return roundTo(lbToKg(value), 2);
    case 'temperature':
      return roundTo(fahrenheitToCelsius(value), 1);
    default:
      return value;
  }
}

function parse(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toMeasurementSubmission(
  draft: MeasurementDraft,
  unitSystem: UnitSystem,
): MeasurementDraftResult {
  if (!isValidIsoDate(draft.measuredOn)) return { ok: false, error: 'date' };

  const raw1 = parse(draft.value1);
  if (raw1 === null) return { ok: false, error: 'value' };
  const v1 = toMetric(draft.kind, raw1, unitSystem);

  if (draft.kind === 'bp') {
    const raw2 = parse(draft.value2);
    if (raw2 === null) return { ok: false, error: 'value' };
    // Blood pressure is never converted, so the second value is already metric.
    if (!inRange(v1, SYSTOLIC_RANGE) || !inRange(raw2, DIASTOLIC_RANGE)) {
      return { ok: false, error: 'value' };
    }
    return { ok: true, submission: { kind: 'bp', v1, v2: raw2, measuredOn: draft.measuredOn } };
  }

  if (!inRange(v1, RANGES[draft.kind])) return { ok: false, error: 'value' };
  return { ok: true, submission: { kind: draft.kind, v1, v2: null, measuredOn: draft.measuredOn } };
}
