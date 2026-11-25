/**
 * Blood-pressure classification (ACC/AHA 2017 bands, the set named in the phase spec).
 *
 * Purely informational. The UI always renders the category as text alongside the numbers and
 * pairs it with "Informational only, not medical advice." — colour is never the only channel.
 */

export const BP_CATEGORIES = ['normal', 'elevated', 'stage1', 'stage2', 'very_high'] as const;
export type BpCategory = (typeof BP_CATEGORIES)[number];

export interface BloodPressureReading {
  readonly systolic: number;
  readonly diastolic: number;
}

function isUsable(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * Classifies a reading, or returns `null` when either number is missing/unusable.
 *
 * Bands are evaluated from most severe to least so a reading that crosses two thresholds
 * takes the worse category (130/85 is stage 1, not elevated).
 */
export function bpCategory(systolic: number, diastolic: number): BpCategory | null {
  if (!isUsable(systolic) || !isUsable(diastolic)) return null;
  if (systolic >= 180 || diastolic >= 120) return 'very_high';
  if (systolic >= 140 || diastolic >= 90) return 'stage2';
  if (systolic >= 130 || diastolic >= 80) return 'stage1';
  if (systolic >= 120) return 'elevated';
  return 'normal';
}

/** True when both numbers parse as plausible millimetres of mercury. */
export function isPlausibleReading(systolic: number, diastolic: number): boolean {
  return (
    isUsable(systolic) &&
    isUsable(diastolic) &&
    systolic >= 50 &&
    systolic <= 300 &&
    diastolic >= 20 &&
    diastolic <= 200
  );
}

/** Formats a reading for display, e.g. `128/82`. */
export function formatReading(systolic: number, diastolic: number): string {
  return `${Math.round(systolic)}/${Math.round(diastolic)}`;
}
