/**
 * Body-mass index.
 *
 * BMI is never stored: it is always derived from the latest height and weight, so editing a
 * measurement simply changes what the badge shows (section 9 of the project brief).
 *
 * Every label produced from this module is informational only; the UI pairs it with
 * "Informational only, not medical advice." (ADR-010).
 */
import { type BmiPreset, DEFAULT_BMI_PRESET } from './vocabulary';

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese';

export interface BmiThresholds {
  /** Below this is underweight. */
  readonly underweightBelow: number;
  /** Below this is normal; at or above it is overweight. */
  readonly normalBelow: number;
  /** Below this is overweight; at or above it is obese. */
  readonly overweightBelow: number;
}

/**
 * Band edges per preset. Asian: normal 18.5–22.9, overweight 23–24.9, obese ≥25.
 * WHO: normal 18.5–24.9, overweight 25–29.9, obese ≥30.
 */
export const BMI_THRESHOLDS: Record<BmiPreset, BmiThresholds> = {
  asian: { underweightBelow: 18.5, normalBelow: 23, overweightBelow: 25 },
  who: { underweightBelow: 18.5, normalBelow: 25, overweightBelow: 30 },
};

export interface BmiSummary {
  readonly bmi: number;
  readonly category: BmiCategory;
  readonly preset: BmiPreset;
}

/** Rounds to one decimal place, the precision the UI shows. */
export function roundBmi(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * BMI in kg/m², rounded to one decimal.
 *
 * Returns `null` for unusable input (non-finite or non-positive) rather than `NaN`, so a
 * missing height cannot silently render as "NaN" in a badge.
 */
export function computeBmi(heightCm: number, weightKg: number): number | null {
  if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg)) return null;
  if (heightCm <= 0 || weightKg <= 0) return null;
  const heightM = heightCm / 100;
  return roundBmi(weightKg / (heightM * heightM));
}

/**
 * Category for a BMI value.
 *
 * The caller passes the *rounded* BMI the user can see, so the badge always agrees with
 * the number next to it (22.96 rounds to 23.0 and is therefore "overweight" on the Asian
 * preset, rather than a silent mismatch).
 */
export function bmiCategory(bmi: number, preset: BmiPreset = DEFAULT_BMI_PRESET): BmiCategory {
  const thresholds = BMI_THRESHOLDS[preset];
  if (bmi < thresholds.underweightBelow) return 'underweight';
  if (bmi < thresholds.normalBelow) return 'normal';
  if (bmi < thresholds.overweightBelow) return 'overweight';
  return 'obese';
}

/** Convenience: BMI, its category and the preset that produced it, or `null`. */
export function summarizeBmi(
  heightCm: number,
  weightKg: number,
  preset: BmiPreset = DEFAULT_BMI_PRESET,
): BmiSummary | null {
  const bmi = computeBmi(heightCm, weightKg);
  if (bmi === null) return null;
  return { bmi, category: bmiCategory(bmi, preset), preset };
}
