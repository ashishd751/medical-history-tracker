/**
 * The migration runner (ADR-018).
 *
 * It deliberately talks to a tiny port rather than to Drizzle, because DDL is executed as
 * whole statements and `PRAGMA user_version` cannot be parameterised. The port is implemented
 * once for `expo-sqlite` (app) and once for `node:sqlite` (tests), so both run this same code.
 */
import { type AppError, appError } from '../lib/errors';
import { err, ok, type Result } from '../lib/result';
import { LATEST_SCHEMA_VERSION, MIGRATIONS } from './migrations';

export interface MigrationDatabase {
  getUserVersion(): number;
  setUserVersion(version: number): void;
  /** Runs one or more statements; used for DDL and PRAGMAs. */
  exec(source: string): void;
  /** Runs `work` inside BEGIN/COMMIT, rolling back when it throws. Must be synchronous. */
  transaction(work: () => void): void;
}

/** The subset of the `expo-sqlite` database object the runner needs. */
export interface SyncSqliteClient {
  execSync(source: string): void;
  getFirstSync<T>(source: string): T | null;
  withTransactionSync(task: () => void): void;
}

export function createMigrationDatabase(client: SyncSqliteClient): MigrationDatabase {
  return {
    getUserVersion: () =>
      client.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0,
    setUserVersion: (version) => {
      // PRAGMA values cannot be bound, so the value is validated instead of interpolated blindly.
      if (!Number.isInteger(version) || version < 0) {
        throw new Error(`Refusing to set a non-integer schema version: ${String(version)}`);
      }
      client.execSync(`PRAGMA user_version = ${version}`);
    },
    exec: (source) => {
      client.execSync(source);
    },
    transaction: (work) => {
      client.withTransactionSync(work);
    },
  };
}

/**
 * Brings the database up to `LATEST_SCHEMA_VERSION`.
 *
 * Returns the version now in place. Each migration is applied inside its own transaction
 * together with its `user_version` bump, so an interrupted upgrade can be retried rather than
 * leaving a half-created schema that claims to be current.
 */
export function runMigrations(db: MigrationDatabase): Result<number, AppError> {
  try {
    const current = db.getUserVersion();
    if (current > LATEST_SCHEMA_VERSION) {
      // A newer build already upgraded this database. Opening it read-write would corrupt it.
      return err(
        appError(
          'DB_FAILURE',
          `Database is at schema v${current}, newer than the supported v${LATEST_SCHEMA_VERSION}.`,
        ),
      );
    }

    for (const migration of MIGRATIONS) {
      if (migration.version <= current) continue;
      db.transaction(() => {
        for (const statement of migration.statements) db.exec(statement);
        db.setUserVersion(migration.version);
      });
    }

    const applied = db.getUserVersion();
    if (applied !== LATEST_SCHEMA_VERSION) {
      return err(
        appError(
          'DB_FAILURE',
          `Migration stopped at v${applied}; expected v${LATEST_SCHEMA_VERSION}.`,
        ),
      );
    }
    return ok(applied);
  } catch (error) {
    return err(appError('DB_FAILURE', 'Database migration failed.', error));
  }
}
