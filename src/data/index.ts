import { type AppRepositories, getRepositories } from './repositories';

export { type AppDatabase, DATABASE_NAME, getAppDatabase, resetAppDatabase } from './db';
export { LATEST_SCHEMA_VERSION } from './migrations';
export {
  type AppRepositories,
  type AppSettings,
  createRepositories,
  DEFAULT_PAGE_LIMIT,
  type DoctorRepository,
  getRepositories,
  type MeasurementRepository,
  type MedicationInput,
  type MedicationRepository,
  type PersonRepository,
  type ReadingInput,
  type RecordDetail,
  type RecordFilter,
  type RecordFormInput,
  type RecordPage,
  type RecordRepository,
  type RecordSummary,
  type RecordView,
  SETTING_KEYS,
  type SettingsRepository,
  type TestResultRepository,
  type VitalInput,
} from './repositories';
export type {
  AttachmentRow,
  DoctorRow,
  MeasurementRow,
  MedicationRow,
  PersonRow,
  RecordRow,
  TestResultRow,
} from './schema';
export { rebuildSearchIndex } from './searchIndex';

/**
 * The repositories, or a thrown error.
 *
 * Screens only render after `app/index.tsx` has confirmed the database opened (the session
 * carries the failure otherwise), so reaching this with a broken database means a real bug.
 * Throwing keeps the happy path readable inside a query function.
 */
export function requireRepositories(): AppRepositories {
  const result = getRepositories();
  if (!result.ok) throw result.error;
  return result.value;
}
