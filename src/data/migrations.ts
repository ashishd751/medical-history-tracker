/**
 * Forward-only schema migrations (ADR-018).
 *
 * These strings are the SQL that runs on the device. `schema.ts` is the typed view of the
 * same tables and `schemaDrift.test.ts` fails if the two disagree, so neither can drift
 * silently. A released migration is never edited — corrections arrive as a new version.
 */

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly statements: readonly string[];
}

const personTable = `
CREATE TABLE person (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  dob TEXT NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('female', 'male', 'other', 'prefer_not_to_say')),
  blood_type TEXT CHECK (
    blood_type IS NULL OR blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
  ),
  allergies TEXT,
  chronic_conditions TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`;

const doctorTable = `
CREATE TABLE doctor (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL DEFAULT '',
  clinic TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT ''
)`;

const recordTable = `
CREATE TABLE record (
  id TEXT PRIMARY KEY NOT NULL,
  person_id TEXT NOT NULL REFERENCES person (id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (
    kind IN ('doctor_visit', 'self_care', 'lab_test', 'procedure', 'vaccination', 'other')
  ),
  title TEXT NOT NULL,
  symptoms TEXT NOT NULL DEFAULT '[]',
  condition TEXT NOT NULL DEFAULT '',
  doctor_id TEXT REFERENCES doctor (id) ON DELETE SET NULL,
  facility TEXT NOT NULL DEFAULT '',
  prescription_text TEXT NOT NULL DEFAULT '',
  comments TEXT NOT NULL DEFAULT '',
  follow_up_on TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`;

const medicationTable = `
CREATE TABLE medication (
  id TEXT PRIMARY KEY NOT NULL,
  person_id TEXT NOT NULL REFERENCES person (id) ON DELETE CASCADE,
  record_id TEXT REFERENCES record (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dose TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  start_on TEXT NOT NULL,
  end_on TEXT,
  status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed', 'stopped')),
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ocr')),
  reviewed_at INTEGER
)`;

const testResultTable = `
CREATE TABLE test_result (
  id TEXT PRIMARY KEY NOT NULL,
  record_id TEXT NOT NULL REFERENCES record (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  numeric_value REAL,
  unit TEXT NOT NULL DEFAULT '',
  ref_low REAL,
  ref_high REAL,
  flag TEXT NOT NULL DEFAULT 'unknown' CHECK (flag IN ('low', 'normal', 'high', 'unknown')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ocr')),
  reviewed_at INTEGER
)`;

const measurementTable = `
CREATE TABLE measurement (
  id TEXT PRIMARY KEY NOT NULL,
  person_id TEXT NOT NULL REFERENCES person (id) ON DELETE CASCADE,
  record_id TEXT REFERENCES record (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (
    kind IN ('height', 'weight', 'bp', 'pulse', 'temperature', 'spo2', 'glucose')
  ),
  v1 REAL NOT NULL,
  v2 REAL,
  measured_on TEXT NOT NULL,
  created_at INTEGER NOT NULL
)`;

const attachmentTable = `
CREATE TABLE attachment (
  id TEXT PRIMARY KEY NOT NULL,
  record_id TEXT NOT NULL REFERENCES record (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('prescription', 'lab_report', 'other')),
  mime TEXT NOT NULL DEFAULT 'application/octet-stream',
  rel_path TEXT NOT NULL,
  thumb_rel_path TEXT,
  bytes INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL DEFAULT '',
  ocr_text TEXT,
  handwriting_likely INTEGER,
  created_at INTEGER NOT NULL
)`;

const appSettingTable = `
CREATE TABLE app_setting (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
)`;

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    statements: [
      personTable,
      doctorTable,
      recordTable,
      medicationTable,
      testResultTable,
      measurementTable,
      attachmentTable,
      appSettingTable,
      'CREATE INDEX record_person_id_date_idx ON record (person_id, date)',
      'CREATE INDEX measurement_person_id_kind_measured_on_idx ON measurement (person_id, kind, measured_on)',
      'CREATE INDEX medication_person_id_status_idx ON medication (person_id, status)',
      'CREATE INDEX attachment_record_id_idx ON attachment (record_id)',
    ],
  },
];

/** The version a freshly migrated database must report. */
export const LATEST_SCHEMA_VERSION: number = MIGRATIONS.at(-1)?.version ?? 0;
