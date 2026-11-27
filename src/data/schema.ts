/**
 * Drizzle table definitions.
 *
 * Column names are snake_case in SQL and camelCase in TypeScript. Every enum-like column is
 * typed with a domain union, and the SQL in `migrations.ts` carries the matching CHECK
 * constraint — `schemaDrift.test.ts` fails if the two ever disagree.
 *
 * Timestamps are UTC epoch milliseconds; dateless dates are `YYYY-MM-DD` strings (ADR-017).
 */
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type {
  AttachmentRole,
  BloodType,
  DataSource,
  MeasurementKind,
  MedicationStatus,
  ReadingFlag,
  RecordKind,
  Sex,
} from '../domain';

export const person = sqliteTable('person', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** `YYYY-MM-DD` in the device's local calendar. */
  dob: text('dob').notNull(),
  sex: text('sex').$type<Sex>().notNull(),
  bloodType: text('blood_type').$type<BloodType>(),
  allergies: text('allergies'),
  chronicConditions: text('chronic_conditions'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const doctor = sqliteTable('doctor', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  specialty: text('specialty').notNull().default(''),
  clinic: text('clinic').notNull().default(''),
  phone: text('phone').notNull().default(''),
});

export const record = sqliteTable(
  'record',
  {
    id: text('id').primaryKey(),
    personId: text('person_id')
      .notNull()
      .references(() => person.id, { onDelete: 'cascade' }),
    /** `YYYY-MM-DD`. */
    date: text('date').notNull(),
    kind: text('kind').$type<RecordKind>().notNull(),
    title: text('title').notNull(),
    /** JSON array of strings; parsed defensively by the repository. */
    symptoms: text('symptoms').notNull().default('[]'),
    condition: text('condition').notNull().default(''),
    doctorId: text('doctor_id').references(() => doctor.id, { onDelete: 'set null' }),
    facility: text('facility').notNull().default(''),
    prescriptionText: text('prescription_text').notNull().default(''),
    comments: text('comments').notNull().default(''),
    followUpOn: text('follow_up_on'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('record_person_id_date_idx').on(table.personId, table.date)],
);

export const medication = sqliteTable(
  'medication',
  {
    id: text('id').primaryKey(),
    personId: text('person_id')
      .notNull()
      .references(() => person.id, { onDelete: 'cascade' }),
    recordId: text('record_id').references(() => record.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    dose: text('dose').notNull().default(''),
    frequency: text('frequency').notNull().default(''),
    duration: text('duration').notNull().default(''),
    startOn: text('start_on').notNull(),
    endOn: text('end_on'),
    status: text('status').$type<MedicationStatus>().notNull().default('ongoing'),
    notes: text('notes').notNull().default(''),
    source: text('source').$type<DataSource>().notNull().default('manual'),
    reviewedAt: integer('reviewed_at'),
    /** 1 when Undo took this row out of the profile; it stays on the record (ADR-039). */
    profileExcluded: integer('profile_excluded', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [index('medication_person_id_status_idx').on(table.personId, table.status)],
);

export const testResult = sqliteTable('test_result', {
  id: text('id').primaryKey(),
  recordId: text('record_id')
    .notNull()
    .references(() => record.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** The value exactly as printed, so "1.2 (H)" survives. */
  value: text('value').notNull(),
  numericValue: real('numeric_value'),
  unit: text('unit').notNull().default(''),
  refLow: real('ref_low'),
  refHigh: real('ref_high'),
  flag: text('flag').$type<ReadingFlag>().notNull().default('unknown'),
  source: text('source').$type<DataSource>().notNull().default('manual'),
  reviewedAt: integer('reviewed_at'),
});

export const measurement = sqliteTable(
  'measurement',
  {
    id: text('id').primaryKey(),
    personId: text('person_id')
      .notNull()
      .references(() => person.id, { onDelete: 'cascade' }),
    recordId: text('record_id').references(() => record.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<MeasurementKind>().notNull(),
    /** Canonical metric value: centimetres, kilograms, or systolic pressure. */
    v1: real('v1').notNull(),
    /** Second value for two-value kinds only (`bp` diastolic). */
    v2: real('v2'),
    measuredOn: text('measured_on').notNull(),
    createdAt: integer('created_at').notNull(),
    /** 1 when Undo took this row out of the profile; it stays in the history (ADR-039). */
    profileExcluded: integer('profile_excluded', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    index('measurement_person_id_kind_measured_on_idx').on(
      table.personId,
      table.kind,
      table.measuredOn,
    ),
  ],
);

export const attachment = sqliteTable(
  'attachment',
  {
    id: text('id').primaryKey(),
    recordId: text('record_id')
      .notNull()
      .references(() => record.id, { onDelete: 'cascade' }),
    role: text('role').$type<AttachmentRole>().notNull(),
    mime: text('mime').notNull().default('application/octet-stream'),
    /** Relative to the app's documents directory — never an absolute URI. */
    relPath: text('rel_path').notNull(),
    thumbRelPath: text('thumb_rel_path'),
    bytes: integer('bytes').notNull().default(0),
    sha256: text('sha256').notNull().default(''),
    ocrText: text('ocr_text'),
    handwritingLikely: integer('handwriting_likely', { mode: 'boolean' }),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('attachment_record_id_idx').on(table.recordId)],
);

export const appSetting = sqliteTable('app_setting', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type PersonRow = typeof person.$inferSelect;
export type DoctorRow = typeof doctor.$inferSelect;
export type RecordRow = typeof record.$inferSelect;
export type MedicationRow = typeof medication.$inferSelect;
export type TestResultRow = typeof testResult.$inferSelect;
export type MeasurementRow = typeof measurement.$inferSelect;
export type AttachmentRow = typeof attachment.$inferSelect;
export type AppSettingRow = typeof appSetting.$inferSelect;

/** Passed to `drizzle()` so `db.query.*` is available; the repositories use the query builder. */
export const schema = {
  person,
  doctor,
  record,
  medication,
  testResult,
  measurement,
  attachment,
  appSetting,
};
