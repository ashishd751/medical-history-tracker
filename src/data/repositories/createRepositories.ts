/**
 * Repository construction.
 *
 * Deliberately separate from `index.ts`: this module must not import the app's database
 * connection (which loads `expo-sqlite`), so tests can build repositories over the in-memory
 * SQLite harness without touching a native module (ADR-019).
 */
import type { AppDatabase } from '../db';
import { defaultRepositoryDeps, type RepositoryDeps } from './deps';
import { createDoctorRepository, type DoctorRepository } from './doctorRepository';
import { createMeasurementRepository, type MeasurementRepository } from './measurementRepository';
import { createMedicationRepository, type MedicationRepository } from './medicationRepository';
import { createPersonRepository, type PersonRepository } from './personRepository';
import { createRecordRepository, type RecordRepository } from './recordRepository';
import { createSettingsRepository, type SettingsRepository } from './settingsRepository';
import { createTestResultRepository, type TestResultRepository } from './testResultRepository';

export interface AppRepositories {
  readonly people: PersonRepository;
  readonly records: RecordRepository;
  readonly medications: MedicationRepository;
  readonly readings: TestResultRepository;
  readonly measurements: MeasurementRepository;
  readonly doctors: DoctorRepository;
  readonly settings: SettingsRepository;
}

export function createRepositories(
  db: AppDatabase,
  deps: RepositoryDeps = defaultRepositoryDeps,
): AppRepositories {
  return {
    people: createPersonRepository(db, deps),
    records: createRecordRepository(db, deps),
    medications: createMedicationRepository(db, deps),
    readings: createTestResultRepository(db),
    measurements: createMeasurementRepository(db, deps),
    doctors: createDoctorRepository(db, deps),
    settings: createSettingsRepository(db),
  };
}
