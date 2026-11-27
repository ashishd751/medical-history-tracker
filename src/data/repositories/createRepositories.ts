/**
 * Repository construction.
 *
 * Deliberately separate from `index.ts`: this module must not import the app's database
 * connection (which loads `expo-sqlite`), so tests can build repositories over the in-memory
 * SQLite harness without touching a native module (ADR-019).
 */
import type { AppDatabase } from '../db';
import { type AttachmentRepository, createAttachmentRepository } from './attachmentRepository';
import { defaultRepositoryDeps, type RepositoryDeps } from './deps';
import { createDoctorRepository, type DoctorRepository } from './doctorRepository';
import { createMeasurementRepository, type MeasurementRepository } from './measurementRepository';
import { createMedicationRepository, type MedicationRepository } from './medicationRepository';
import { createPersonRepository, type PersonRepository } from './personRepository';
import { createProfileRepository, type ProfileRepository } from './profileRepository';
import { createRecordRepository, type RecordRepository } from './recordRepository';
import { createSettingsRepository, type SettingsRepository } from './settingsRepository';
import { createTestResultRepository, type TestResultRepository } from './testResultRepository';

export interface AppRepositories {
  readonly people: PersonRepository;
  readonly records: RecordRepository;
  readonly attachments: AttachmentRepository;
  readonly medications: MedicationRepository;
  readonly readings: TestResultRepository;
  readonly measurements: MeasurementRepository;
  readonly doctors: DoctorRepository;
  readonly settings: SettingsRepository;
  readonly profile: ProfileRepository;
}

export function createRepositories(
  db: AppDatabase,
  deps: RepositoryDeps = defaultRepositoryDeps,
): AppRepositories {
  const people = createPersonRepository(db, deps);
  const measurements = createMeasurementRepository(db, deps);
  const medications = createMedicationRepository(db, deps);

  return {
    people,
    records: createRecordRepository(db, deps),
    attachments: createAttachmentRepository(db, deps.now),
    medications,
    readings: createTestResultRepository(db),
    measurements,
    doctors: createDoctorRepository(db, deps),
    settings: createSettingsRepository(db),
    // The profile reads through the same repositories so its queries cannot drift from theirs.
    profile: createProfileRepository(db, { people, measurements, medications }),
  };
}
