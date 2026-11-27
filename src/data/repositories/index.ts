/**
 * The repository set. Features ask for this once and use the typed objects; nothing outside
 * `src/data` touches Drizzle (see ARCHITECTURE.md).
 */
import type { AppError } from '../../lib/errors';
import { ok, type Result } from '../../lib/result';
import { type AppDatabase, getAppDatabase } from '../db';
import { type AppRepositories, createRepositories } from './createRepositories';

let cached: { db: AppDatabase; repositories: AppRepositories } | null = null;

/** The app's repositories, built over the memoised connection. */
export function getRepositories(): Result<AppRepositories, AppError> {
  const database = getAppDatabase();
  if (!database.ok) return database;
  if (!cached || cached.db !== database.value) {
    cached = { db: database.value, repositories: createRepositories(database.value) };
  }
  return ok(cached.repositories);
}

export {
  type AttachmentInput,
  attachmentPathsOf,
  type AttachmentRepository,
} from './attachmentRepository';
export { type AppRepositories, createRepositories } from './createRepositories';
export { defaultRepositoryDeps, type RepositoryDeps } from './deps';
export { type DoctorInput, type DoctorRepository } from './doctorRepository';
export { type MeasurementInput, type MeasurementRepository } from './measurementRepository';
export { type MedicationPatch, type MedicationRepository } from './medicationRepository';
export { type NewPersonInput, type PersonPatch, type PersonRepository } from './personRepository';
export {
  type ProfileRepository,
  type ProfileSnapshotOptions,
  type ProfileSources,
} from './profileRepository';
export {
  DEFAULT_PAGE_LIMIT,
  type MedicationInput,
  parseSymptoms,
  type ReadingInput,
  type RecordDetail,
  type RecordFilter,
  type RecordFormInput,
  type RecordPage,
  type RecordRemoval,
  type RecordRepository,
  type RecordSummary,
  type RecordView,
  type VitalInput,
} from './recordRepository';
export {
  type AppSettings,
  MAX_DRAFT_LENGTH,
  SETTING_KEYS,
  type SettingsRepository,
} from './settingsRepository';
export { type TestResultRepository } from './testResultRepository';
