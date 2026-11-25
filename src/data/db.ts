/**
 * The one database connection the app uses.
 *
 * Opening is lazy and memoised: the first repository call (or the app bootstrap) opens the
 * file, enables foreign keys, and runs pending migrations. A failure is returned as a
 * `Result` so the UI can show an in-app banner instead of crashing on launch.
 */
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite/driver';
import { openDatabaseSync } from 'expo-sqlite';

import { type AppError, appError } from '../lib/errors';
import { err, ok, type Result } from '../lib/result';
import { createMigrationDatabase, runMigrations } from './migrate';
import { schema } from './schema';

export const DATABASE_NAME = 'medical-history.db';

/** The Drizzle database bound to the Phase 1 schema. */
export type AppDatabase = ExpoSQLiteDatabase<typeof schema>;

let cached: Result<AppDatabase, AppError> | null = null;

export function getAppDatabase(): Result<AppDatabase, AppError> {
  cached ??= openDatabase();
  return cached;
}

/**
 * Forgets the memoised connection. Used by tests and by the future "restore backup" flow,
 * which must reopen the file after replacing it (Phase 5).
 */
export function resetAppDatabase(): void {
  cached = null;
}

function openDatabase(): Result<AppDatabase, AppError> {
  let client;
  try {
    client = openDatabaseSync(DATABASE_NAME);
    // WAL persists per database file; `foreign_keys` is per connection and must be set before
    // any transaction starts, otherwise cascades silently do nothing.
    client.execSync('PRAGMA journal_mode = WAL;');
    client.execSync('PRAGMA foreign_keys = ON;');
  } catch (error) {
    return err(appError('DB_FAILURE', 'Could not open the local database.', error));
  }

  const migrated = runMigrations(createMigrationDatabase(client));
  if (!migrated.ok) {
    try {
      client.closeSync();
    } catch {
      // Best effort: the handle is already unusable.
    }
    return err(migrated.error);
  }

  return ok(drizzle(client, { schema }));
}
