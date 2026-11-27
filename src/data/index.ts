import { type AppRepositories, getRepositories } from './repositories';

export { type AppDatabase, DATABASE_NAME, getAppDatabase, resetAppDatabase } from './db';
export {
  createExpoFileSystemPort,
  createFileStore,
  type FileEntry,
  type FileStore,
  type FileSystemPort,
  getFileStore,
  type ImportedFile,
} from './fileStore';
export { sweepAttachmentFiles, type SweepSummary } from './fileSweeper';
export { LATEST_SCHEMA_VERSION } from './migrations';
export {
  type AppRepositories,
  type AppSettings,
  type AttachmentInput,
  attachmentPathsOf,
  type AttachmentRepository,
  createRepositories,
  DEFAULT_PAGE_LIMIT,
  type DoctorRepository,
  type ExportPreferences,
  type ExportRepository,
  getRepositories,
  type MeasurementRepository,
  type MedicationInput,
  type MedicationRepository,
  type PersonRepository,
  type ProfileRepository,
  type ReadingInput,
  type RecordDetail,
  type RecordFilter,
  type RecordFormInput,
  type RecordPage,
  type RecordRemoval,
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
export { sweepAttachmentsAtStartup } from './startupSweep';

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
