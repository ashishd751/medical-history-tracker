/**
 * The controlled vocabularies of the medical model.
 *
 * These values are what SQLite stores, so they are frozen tuples: the CHECK constraints in
 * `src/data/migrations.ts` list exactly the same strings, and a drift test fails if the two
 * ever disagree. User-facing labels for each value live in `src/ui/labels.ts` — the domain
 * layer never contains display text.
 */

export const RECORD_KINDS = [
  'doctor_visit',
  'self_care',
  'lab_test',
  'procedure',
  'vaccination',
  'other',
] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

/** Only doctor visits and procedures record a facility (section 8.4 of the phase spec). */
export const FACILITY_KINDS: readonly RecordKind[] = ['doctor_visit', 'procedure'];

export const SEXES = ['female', 'male', 'other', 'prefer_not_to_say'] as const;
export type Sex = (typeof SEXES)[number];

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

export const MEDICATION_STATUSES = ['ongoing', 'completed', 'stopped'] as const;
export type MedicationStatus = (typeof MEDICATION_STATUSES)[number];

/** Where a value came from. `ocr` values must be reviewed before they are trusted (Phase 6). */
export const DATA_SOURCES = ['manual', 'ocr'] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

/** How a lab reading compares with its reference range. Rendered as text, never colour alone. */
export const READING_FLAGS = ['low', 'normal', 'high', 'unknown'] as const;
export type ReadingFlag = (typeof READING_FLAGS)[number];

export const MEASUREMENT_KINDS = [
  'height',
  'weight',
  'bp',
  'pulse',
  'temperature',
  'spo2',
  'glucose',
] as const;
export type MeasurementKind = (typeof MEASUREMENT_KINDS)[number];

/**
 * Canonical (metric) unit per measurement kind. Measurements are stored in these units and
 * converted only for display (section 9 of the project brief).
 */
export const MEASUREMENT_UNITS: Record<MeasurementKind, string> = {
  height: 'cm',
  weight: 'kg',
  bp: 'mmHg',
  pulse: 'bpm',
  temperature: '°C',
  spo2: '%',
  glucose: 'mg/dL',
};

/** `bp` is the only kind that needs two numbers (systolic and diastolic). */
export const TWO_VALUE_KINDS: readonly MeasurementKind[] = ['bp'];

export const ATTACHMENT_ROLES = ['prescription', 'lab_report', 'other'] as const;
export type AttachmentRole = (typeof ATTACHMENT_ROLES)[number];

export const UNIT_SYSTEMS = ['metric', 'imperial'] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

export const BMI_PRESETS = ['asian', 'who'] as const;
export type BmiPreset = (typeof BMI_PRESETS)[number];

/** ADR-010: Asian thresholds are the default; WHO is selectable. */
export const DEFAULT_BMI_PRESET: BmiPreset = 'asian';
export const DEFAULT_UNIT_SYSTEM: UnitSystem = 'metric';

/** The six blood types a person can confirm; `null` in storage means "not recorded". */
export function isBloodType(value: string): value is BloodType {
  return (BLOOD_TYPES as readonly string[]).includes(value);
}
