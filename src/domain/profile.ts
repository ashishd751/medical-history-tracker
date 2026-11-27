/**
 * The derived profile (Phase 3).
 *
 * The profile is never stored. It is recomputed on every read from the newest measurement of each
 * kind, the person's blood type and the medications that are current today, which is what makes a
 * backdated record safe: it joins the history but cannot overwrite a newer value (section 9).
 *
 * Everything here is pure: no React, no database, no display text. `today` and the BMI preset are
 * injected so the same code is testable at any date and reusable by the Phase 4 PDF header and the
 * Phase 6 scan review.
 */
import { type BmiCategory, bmiCategory, computeBmi } from './bmi';
import type { BloodType, BmiPreset, MedicationStatus } from './vocabulary';

/** One medication as the profile shows it: a name to display and an id to act on. */
export interface ProfileMedication {
  readonly id: string;
  readonly name: string;
}

export interface ProfileBloodPressure {
  readonly systolic: number;
  readonly diastolic: number;
  /** `YYYY-MM-DD` of the reading, for the "on …" line. */
  readonly measuredOn: string;
}

/** The values a profile shows. `null` means "not recorded", never zero. */
export interface ProfileSnapshot {
  readonly heightCm: number | null;
  readonly weightKg: number | null;
  /** Derived from the latest height and weight; never stored. */
  readonly bmi: number | null;
  readonly bmiCategory: BmiCategory | null;
  readonly bloodPressure: ProfileBloodPressure | null;
  readonly bloodType: BloodType | null;
  /** Current medication, in the order the repository returns it (newest start first). */
  readonly medications: readonly ProfileMedication[];
}

/**
 * How far apart two stored values must be before the user is told the profile changed.
 *
 * A scale that reports 70.02 kg for 70.00 kg is noise, not news, and a row in the "Profile updated"
 * sheet about it would train the user to dismiss the sheet. Height is entered in inches under the
 * imperial setting, so its tolerance is the centimetre value of a tenth of an inch.
 */
export const PROFILE_TOLERANCE = {
  heightCm: 0.5,
  weightKg: 0.05,
} as const;

/** Blood pressure as a comparable pair; the date is deliberately not part of equality. */
export interface ProfileBloodPressureValue {
  readonly systolic: number;
  readonly diastolic: number;
}

export type ProfileNumberField = 'height' | 'weight' | 'bmi';

/**
 * One row of the "Profile updated" sheet, in metric. Formatting (units, labels) happens in `src/ui`
 * so this layer stays free of display text.
 *
 * A change of current medication is a set difference rather than an old/new pair: comparing two
 * comma-joined lists reads badly at 360 dp, and "added" / "removed" is what the user needs to know.
 */
export type ProfileChange =
  | {
      readonly kind: ProfileNumberField;
      readonly from: number | null;
      readonly to: number | null;
    }
  | {
      readonly kind: 'bloodPressure';
      readonly from: ProfileBloodPressureValue | null;
      readonly to: ProfileBloodPressureValue | null;
    }
  | {
      readonly kind: 'bloodType';
      readonly from: BloodType | null;
      readonly to: BloodType | null;
    }
  | {
      readonly kind: 'medications';
      readonly added: readonly string[];
      readonly removed: readonly string[];
    };

/**
 * What Undo does: these rows stop counting towards the profile.
 *
 * They are flagged rather than deleted, so the record keeps its own vitals and the history can say
 * "not counted in the profile" instead of silently losing a number (ADR-039).
 */
export interface ProfileUndoPlan {
  readonly measurementIds: readonly string[];
  readonly medicationIds: readonly string[];
}

export function emptyProfileSnapshot(): ProfileSnapshot {
  return {
    heightCm: null,
    weightKg: null,
    bmi: null,
    bmiCategory: null,
    bloodPressure: null,
    bloodType: null,
    medications: [],
  };
}

export interface ProfileSnapshotInput {
  readonly heightCm: number | null;
  readonly weightKg: number | null;
  readonly bloodPressure: ProfileBloodPressure | null;
  readonly bloodType: BloodType | null;
  readonly medications: readonly ProfileMedication[];
  readonly bmiPreset: BmiPreset;
}

/**
 * Assembles a snapshot from the newest rows, deriving BMI on the way through.
 *
 * The BMI category is resolved against the stored preset so every screen shows the same word for
 * the same number (ADR-010).
 */
export function buildProfileSnapshot(input: ProfileSnapshotInput): ProfileSnapshot {
  const bmi =
    input.heightCm !== null && input.weightKg !== null
      ? computeBmi(input.heightCm, input.weightKg)
      : null;
  return {
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    bmi,
    bmiCategory: bmi === null ? null : bmiCategory(bmi, input.bmiPreset),
    bloodPressure: input.bloodPressure,
    bloodType: input.bloodType,
    medications: input.medications,
  };
}

/** A measurement is current when it is ongoing and has not already ended. */
export interface MedicationCurrentness {
  readonly status: MedicationStatus;
  readonly endOn: string | null;
}

/**
 * The one definition of "current medication" (ADR-043): ongoing, and either open-ended or ending
 * today or later. `today` is the device's local calendar date, passed in so the rule is testable.
 *
 * ISO dates are zero-padded, so a string comparison is a date comparison; `src/lib` may not be
 * imported here because the domain is self-contained.
 */
export function isCurrentMedication(medication: MedicationCurrentness, today: string): boolean {
  if (medication.status !== 'ongoing') return false;
  if (medication.endOn === null) return true;
  return medication.endOn >= today;
}

/**
 * Whether replacing `previous` with `next` needs an explicit confirmation.
 *
 * Setting a blood type for the first time is a plain answer to a question nobody had data for;
 * replacing one, or clearing one, changes something the user already asserted and must be
 * confirmed. Phase 6 reuses this for a scan that reports a different group (ADR-044).
 */
export function requiresBloodTypeConfirmation(
  previous: BloodType | null,
  next: BloodType | null,
): boolean {
  return previous !== null && previous !== next;
}

function numbersDiffer(from: number | null, to: number | null, tolerance: number): boolean {
  if (from === null || to === null) return from !== to;
  // `>=` rather than `>`: the published tolerance is the smallest difference that counts.
  return Math.abs(from - to) >= tolerance;
}

/** BMI is compared at the precision the user can see, so 22.94 → 22.96 is not a change. */
function bmiDiffers(from: number | null, to: number | null): boolean {
  if (from === null || to === null) return from !== to;
  return Math.round(from * 10) !== Math.round(to * 10);
}

function bloodPressureValue(value: ProfileBloodPressure | null): ProfileBloodPressureValue | null {
  return value === null ? null : { systolic: value.systolic, diastolic: value.diastolic };
}

function bloodPressureDiffers(
  from: ProfileBloodPressure | null,
  to: ProfileBloodPressure | null,
): boolean {
  if (from === null || to === null) return from !== to;
  return (
    Math.round(from.systolic) !== Math.round(to.systolic) ||
    Math.round(from.diastolic) !== Math.round(to.diastolic)
  );
}

function medicationDiff(
  before: readonly ProfileMedication[],
  after: readonly ProfileMedication[],
): { added: readonly string[]; removed: readonly string[] } {
  const beforeNames = new Set(before.map((medication) => medication.name));
  const afterNames = new Set(after.map((medication) => medication.name));
  return {
    added: [...afterNames].filter((name) => !beforeNames.has(name)),
    removed: [...beforeNames].filter((name) => !afterNames.has(name)),
  };
}

/**
 * The profile changes a save produced, in the order the profile itself reads: body, blood
 * pressure, blood type, then medication. An empty array means the sheet must not appear.
 */
export function computeProfileDiff(
  before: ProfileSnapshot,
  after: ProfileSnapshot,
): readonly ProfileChange[] {
  const changes: ProfileChange[] = [];

  if (numbersDiffer(before.heightCm, after.heightCm, PROFILE_TOLERANCE.heightCm)) {
    changes.push({ kind: 'height', from: before.heightCm, to: after.heightCm });
  }
  if (numbersDiffer(before.weightKg, after.weightKg, PROFILE_TOLERANCE.weightKg)) {
    changes.push({ kind: 'weight', from: before.weightKg, to: after.weightKg });
  }
  if (bmiDiffers(before.bmi, after.bmi)) {
    changes.push({ kind: 'bmi', from: before.bmi, to: after.bmi });
  }
  if (bloodPressureDiffers(before.bloodPressure, after.bloodPressure)) {
    changes.push({
      kind: 'bloodPressure',
      from: bloodPressureValue(before.bloodPressure),
      to: bloodPressureValue(after.bloodPressure),
    });
  }
  if (before.bloodType !== after.bloodType) {
    changes.push({ kind: 'bloodType', from: before.bloodType, to: after.bloodType });
  }

  const medications = medicationDiff(before.medications, after.medications);
  if (medications.added.length > 0 || medications.removed.length > 0) {
    changes.push({ kind: 'medications', ...medications });
  }

  return changes;
}

/** True when the snapshot holds nothing at all. */
export function isEmptyProfileSnapshot(snapshot: ProfileSnapshot): boolean {
  return (
    snapshot.heightCm === null &&
    snapshot.weightKg === null &&
    snapshot.bmi === null &&
    snapshot.bloodPressure === null &&
    snapshot.bloodType === null &&
    snapshot.medications.length === 0
  );
}
