/**
 * Test-only SQLite harness (ADR-019).
 *
 * Drizzle's expo-sqlite driver is synchronous and only needs `prepareSync` on its client, so
 * Node's built-in `node:sqlite` can stand in for the native module. Tests therefore run the
 * real Drizzle session, the real SQL and the real migrations against an in-memory database —
 * nothing here is shipped in the app bundle.
 */
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';

import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite/driver';
import type { SQLiteDatabase } from 'expo-sqlite';

import { createMigrationDatabase, runMigrations } from '../migrate';
import { schema } from '../schema';

function toParams(params: unknown): SQLInputValue[] {
  if (params === undefined || params === null) return [];
  // Drizzle passes an already-flattened array of bind values.
  return Array.isArray(params) ? (params as SQLInputValue[]) : [params as SQLInputValue];
}

/** Column order for a statement, or `[]` for statements that return no rows. */
function readColumnNames(statement: StatementSync): string[] {
  try {
    return statement.columns().map((column) => column.name);
  } catch {
    return [];
  }
}

/**
 * A structural stand-in for the `expo-sqlite` database object.
 *
 * It implements the surface the app and the Drizzle driver actually use; the cast at the
 * drizzle() boundary is deliberate, because reproducing expo-sqlite's full class (sessions,
 * extensions, web helpers) would be noise.
 */
function createClient(raw: DatabaseSync) {
  return {
    execSync(source: string): void {
      raw.exec(source);
    },
    getFirstSync<T>(source: string): T | null {
      const row = raw.prepare(source).get();
      return row === undefined ? null : (row as unknown as T);
    },
    withTransactionSync(task: () => void): void {
      raw.exec('BEGIN');
      try {
        task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
    prepareSync(source: string) {
      const statement = raw.prepare(source);
      let cachedColumns: string[] | undefined;
      const columnNames = (): string[] => {
        cachedColumns ??= readColumnNames(statement);
        return cachedColumns;
      };

      return {
        executeSync(params?: unknown) {
          const values = toParams(params);
          let cached: ReturnType<typeof statement.run> | undefined;
          const runOnce = () => (cached ??= statement.run(...values));
          return {
            get changes(): number {
              return Number(runOnce().changes);
            },
            get lastInsertRowId(): number {
              return Number(runOnce().lastInsertRowid);
            },
            getAllSync: () => statement.all(...values),
            getFirstSync: () => statement.get(...values) ?? null,
          };
        },
        executeForRawResultSync(params?: unknown) {
          const values = toParams(params);
          return {
            getAllSync: () =>
              statement.all(...values).map((row) => columnNames().map((name) => row[name] ?? null)),
          };
        },
      };
    },
  };
}

export interface TestDatabase {
  readonly db: ExpoSQLiteDatabase<typeof schema>;
  readonly raw: DatabaseSync;
  close(): void;
}

/** An empty database at `user_version = 0`, with foreign keys on but no schema. */
export function createEmptyTestDatabase(): TestDatabase & {
  readonly client: ReturnType<typeof createClient>;
} {
  const raw = new DatabaseSync(':memory:');
  const client = createClient(raw);
  client.execSync('PRAGMA foreign_keys = ON;');
  const db = drizzle(client as unknown as SQLiteDatabase, { schema });
  return { db, raw, client, close: () => raw.close() };
}

/** A database migrated to the latest schema, ready for repository tests. */
export function createTestDatabase(): TestDatabase {
  const empty = createEmptyTestDatabase();
  const migrated = runMigrations(createMigrationDatabase(empty.client));
  if (!migrated.ok) {
    empty.close();
    throw new Error(`Test database migration failed: ${migrated.error.detail}`);
  }
  return { db: empty.db, raw: empty.raw, close: empty.close };
}
