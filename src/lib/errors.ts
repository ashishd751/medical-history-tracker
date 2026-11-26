import { strings } from '../ui/strings';

/**
 * Expected failure codes. Anything user-visible must map to one of these — raw
 * exception text is never shown (section 16).
 */
export type AppErrorCode =
  | 'UNKNOWN'
  | 'CANCELLED'
  | 'FILE_NOT_FOUND'
  | 'FILE_WRITE_FAILED'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'FILE_CORRUPT'
  | 'DB_FAILURE'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_FAILED'
  | 'IMPORT_INVALID'
  | 'BACKUP_CHECKSUM'
  | 'RECOGNITION_FAILED';

export interface AppError {
  readonly code: AppErrorCode;
  /** Developer-facing detail. Never rendered directly. */
  readonly detail: string;
  readonly cause?: unknown;
}

export function appError(code: AppErrorCode, detail: string, cause?: unknown): AppError {
  return cause === undefined ? { code, detail } : { code, detail, cause };
}

/** True when the failure is an expected "user backed out" case, not an error to report. */
export function isCancellation(error: AppError): boolean {
  return error.code === 'CANCELLED';
}

const userMessages: Record<AppErrorCode, string> = {
  UNKNOWN: strings.errors.unknown,
  CANCELLED: '',
  FILE_NOT_FOUND: strings.errors.fileNotFound,
  FILE_WRITE_FAILED: strings.errors.fileWrite,
  UNSUPPORTED_FILE_TYPE: strings.attachments.unsupportedType,
  FILE_TOO_LARGE: strings.errors.fileTooLarge,
  FILE_CORRUPT: strings.attachments.corrupt,
  DB_FAILURE: strings.errors.db,
  PERMISSION_DENIED: strings.errors.permissionDenied,
  VALIDATION_FAILED: strings.errors.unknown,
  IMPORT_INVALID: strings.errors.importInvalid,
  BACKUP_CHECKSUM: strings.errors.backupChecksum,
  RECOGNITION_FAILED: strings.errors.unknown,
};

/** Maps an AppError to a friendly sentence safe to render. */
export function userMessage(error: AppError): string {
  return userMessages[error.code] || strings.errors.unknown;
}
