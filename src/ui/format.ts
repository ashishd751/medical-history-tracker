/**
 * Display formatting for stored metric values.
 *
 * Measurements are stored in metric and converted only here (section 9). Dates are *not*
 * formatted here — they always go through `formatDisplayDate` from `lib/dates` (ADR-017).
 */
import {
  celsiusToFahrenheit,
  cmToFeetInches,
  cmToIn,
  formatReading,
  kgToLb,
  type MeasurementKind,
  type ProfileBloodPressureValue,
  type ProfileChange,
  roundTo,
  type UnitSystem,
} from '@/domain';

import { bloodTypeLabel } from './labels';
import { strings } from './strings';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** `2026-11-02` → `November 2026`. A label, not a date, so it does not use DD/MM/YYYY. */
export function formatMonthLabel(isoDate: string): string {
  const [year, month] = isoDate.split('-');
  const name = MONTH_NAMES[Number(month) - 1] ?? '';
  return `${name} ${year ?? ''}`.trim();
}

export function formatHeight(cm: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') {
    const { feet, inches } = cmToFeetInches(cm);
    return `${feet} ${strings.units.ft} ${inches} ${strings.units.in}`;
  }
  return `${roundTo(cm, 1)} ${strings.units.cm}`;
}

export function formatWeight(kg: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') {
    return `${roundTo(kgToLb(kg), 1)} ${strings.units.lb}`;
  }
  return `${roundTo(kg, 1)} ${strings.units.kg}`;
}

export function formatBmi(bmi: number): string {
  return roundTo(bmi, 1).toFixed(1);
}

export function formatBloodPressure(systolic: number, diastolic: number): string {
  return `${formatReading(systolic, diastolic)} mmHg`;
}

export function formatPulse(bpm: number): string {
  return `${roundTo(bpm, 0)} ${strings.units.bpm}`;
}

export function formatTemperature(celsius: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') {
    return `${roundTo(celsiusToFahrenheit(celsius), 1)} °F`;
  }
  return `${roundTo(celsius, 1)} ${strings.units.celsius}`;
}

export function formatSpo2(percent: number): string {
  return `${roundTo(percent, 0)} %`;
}

export function formatGlucose(value: number): string {
  return `${roundTo(value, 1)} mg/dL`;
}

/** One label for any measurement kind, used by the snapshot card and the detail vitals list. */
export function formatMeasurement(
  kind: MeasurementKind,
  v1: number,
  v2: number | null,
  unitSystem: UnitSystem,
): string {
  switch (kind) {
    case 'height':
      return formatHeight(v1, unitSystem);
    case 'weight':
      return formatWeight(v1, unitSystem);
    case 'bp':
      return v2 === null ? formatBloodPressure(v1, 0) : formatBloodPressure(v1, v2);
    case 'pulse':
      return formatPulse(v1);
    case 'temperature':
      return formatTemperature(v1, unitSystem);
    case 'spo2':
      return formatSpo2(v1);
    case 'glucose':
      return formatGlucose(v1);
  }
}

/** Centimetres as inches, for the imperial height input. */
export function cmToInches(cm: number): number {
  return roundTo(cmToIn(cm), 1);
}

/** One row of the "Profile updated" sheet, already in the user's units and language. */
export interface ProfileChangeRow {
  /** Stable key for lists; a medication change can produce more than one row. */
  readonly key: string;
  readonly label: string;
  readonly from: string;
  readonly to: string;
  readonly testID: string;
}

function bloodPressureText(value: ProfileBloodPressureValue | null): string {
  return value === null
    ? strings.common.notRecorded
    : formatBloodPressure(value.systolic, value.diastolic);
}

/**
 * Formats a metric profile change for display.
 *
 * Comparison always happens in metric (the snapshot is metric); only this function knows about the
 * unit setting, so flipping units while the sheet is open re-renders the same change correctly.
 * A medication change becomes one row per added or removed name, because "A, B → A, B, C" wraps
 * badly at 360 dp and hides which name is new.
 */
export function formatProfileChange(
  change: ProfileChange,
  unitSystem: UnitSystem,
): readonly ProfileChangeRow[] {
  const notRecorded = strings.common.notRecorded;

  switch (change.kind) {
    case 'height':
      return [
        {
          key: 'height',
          label: strings.profile.changes.height,
          from: change.from === null ? notRecorded : formatHeight(change.from, unitSystem),
          to: change.to === null ? notRecorded : formatHeight(change.to, unitSystem),
          testID: 'profile-change-height',
        },
      ];
    case 'weight':
      return [
        {
          key: 'weight',
          label: strings.profile.changes.weight,
          from: change.from === null ? notRecorded : formatWeight(change.from, unitSystem),
          to: change.to === null ? notRecorded : formatWeight(change.to, unitSystem),
          testID: 'profile-change-weight',
        },
      ];
    case 'bmi':
      return [
        {
          key: 'bmi',
          label: strings.profile.changes.bmi,
          from: change.from === null ? notRecorded : formatBmi(change.from),
          to: change.to === null ? notRecorded : formatBmi(change.to),
          testID: 'profile-change-bmi',
        },
      ];
    case 'bloodPressure':
      return [
        {
          key: 'bloodPressure',
          label: strings.profile.changes.bloodPressure,
          from: bloodPressureText(change.from),
          to: bloodPressureText(change.to),
          testID: 'profile-change-bp',
        },
      ];
    case 'bloodType':
      return [
        {
          key: 'bloodType',
          label: strings.profile.changes.bloodType,
          from: bloodTypeLabel(change.from),
          to: bloodTypeLabel(change.to),
          testID: 'profile-change-blood-type',
        },
      ];
    case 'medications':
      return [
        ...change.added.map((name) => ({
          key: `added-${name}`,
          label: strings.profile.changes.medications,
          from: strings.common.none,
          to: name,
          testID: 'profile-change-medication-added',
        })),
        ...change.removed.map((name) => ({
          key: `removed-${name}`,
          label: strings.profile.changes.medications,
          from: name,
          to: strings.common.none,
          testID: 'profile-change-medication-removed',
        })),
      ];
  }
}

/** Flattens a set of changes into display rows, in the order the domain produced them. */
export function formatProfileChanges(
  changes: readonly ProfileChange[],
  unitSystem: UnitSystem,
): readonly ProfileChangeRow[] {
  return changes.flatMap((change) => formatProfileChange(change, unitSystem));
}
