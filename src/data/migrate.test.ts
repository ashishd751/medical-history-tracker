/**
 * @jest-environment node
 *
 * Migration behaviour against a real in-memory SQLite database (ADR-018, ADR-019).
 */
import { createMigrationDatabase, type MigrationDatabase, runMigrations } from './migrate';
import { LATEST_SCHEMA_VERSION, MIGRATIONS } from './migrations';
import { createEmptyTestDatabase } from './testing/testDatabase';

const TABLES = [
  'person',
  'doctor',
  'record',
  'medication',
  'test_result',
  'measurement',
  'attachment',
  'app_setting',
];

const INDEXES = [
  'record_person_id_date_idx',
  'measurement_person_id_kind_measured_on_idx',
  'medication_person_id_status_idx',
  'attachment_record_id_idx',
];

function tableNames(raw: ReturnType<typeof createEmptyTestDatabase>['raw']): string[] {
  return raw
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'record_fts%'`,
    )
    .all()
    .map((row) => String(row.name))
    .sort();
}

function indexNames(raw: ReturnType<typeof createEmptyTestDatabase>['raw']): string[] {
  return raw
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((row) => String(row.name))
    .sort();
}

/** Builds a database that has exactly the migrations below `version` applied. */
function databaseAtVersion(version: number): {
  raw: ReturnType<typeof createEmptyTestDatabase>['raw'];
  migrations: MigrationDatabase;
  close: () => void;
} {
  const empty = createEmptyTestDatabase();
  const migrations = createMigrationDatabase(empty.client);
  for (const migration of MIGRATIONS) {
    if (migration.version > version) continue;
    migrations.transaction(() => {
      for (const statement of migration.statements) migrations.exec(statement);
      migrations.setUserVersion(migration.version);
    });
  }
  return { raw: empty.raw, migrations, close: empty.close };
}

function seedPerson(raw: ReturnType<typeof createEmptyTestDatabase>['raw']): void {
  raw
    .prepare(
      `INSERT INTO person (id, name, dob, sex, created_at, updated_at)
       VALUES ('p1', 'Synthetic Person', '1990-04-17', 'female', 1, 1)`,
    )
    .run();
}

describe('fresh install', () => {
  it('creates every table, index and the expected version', () => {
    const empty = createEmptyTestDatabase();
    const result = runMigrations(createMigrationDatabase(empty.client));

    expect(result).toEqual({ ok: true, value: LATEST_SCHEMA_VERSION });
    expect(tableNames(empty.raw)).toEqual([...TABLES].sort());
    expect(indexNames(empty.raw)).toEqual([...INDEXES].sort());
    expect(empty.raw.prepare('PRAGMA user_version').get()).toEqual({
      user_version: LATEST_SCHEMA_VERSION,
    });
    empty.close();
  });

  it('leaves the database internally consistent', () => {
    const empty = createEmptyTestDatabase();
    runMigrations(createMigrationDatabase(empty.client));

    expect(empty.raw.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' });
    expect(empty.raw.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    empty.close();
  });
});

describe('migrating from every prior version', () => {
  it.each(MIGRATIONS.map((migration) => [migration.version, migration.name] as const))(
    'upgrades a v%i database (%s) to the latest version and keeps its rows',
    (version) => {
      const previous = version - 1;
      const { raw, migrations, close } = databaseAtVersion(previous);

      // Rows written by the previous schema must survive the upgrade.
      if (previous >= 1) seedPerson(raw);
      expect(raw.prepare('PRAGMA user_version').get()).toEqual({ user_version: previous });
      // `app_setting` arrives with v1, so it must be absent only when starting from v0.
      if (previous < 1) expect(tableNames(raw)).not.toContain('app_setting');

      const result = runMigrations(migrations);

      expect(result).toEqual({ ok: true, value: LATEST_SCHEMA_VERSION });
      expect(raw.prepare('PRAGMA user_version').get()).toEqual({
        user_version: LATEST_SCHEMA_VERSION,
      });
      if (previous >= 1) {
        expect(raw.prepare('SELECT name FROM person').get()).toEqual({ name: 'Synthetic Person' });
      }
      close();
    },
  );
});

describe('v2 search index', () => {
  it('backfills the search index for records that existed before it', () => {
    // A database at v1 with data, exactly like a phone that upgraded the app.
    const { raw, migrations, close } = databaseAtVersion(1);
    seedPerson(raw);
    raw
      .prepare(
        `INSERT INTO record (id, person_id, date, kind, title, symptoms, created_at, updated_at)
         VALUES ('r1', 'p1', '2026-10-01', 'lab_test', 'Synthetic blood work',
                 '["synthetic headache"]', 1, 1)`,
      )
      .run();

    expect(runMigrations(migrations)).toEqual({ ok: true, value: LATEST_SCHEMA_VERSION });

    // `ache` is a mid-word substring, which only the trigram tokenizer matches.
    expect(
      raw.prepare("SELECT COUNT(*) AS n FROM record_fts WHERE record_fts MATCH 'ache'").get(),
    ).toEqual({ n: 1 });
    close();
  });

  it('keeps the index in step with inserts, updates and deletes', () => {
    const empty = createEmptyTestDatabase();
    runMigrations(createMigrationDatabase(empty.client));
    seedPerson(empty.raw);

    const matches = (term: string): number => {
      const row = empty.raw
        .prepare('SELECT COUNT(*) AS n FROM record_fts WHERE record_fts MATCH ?')
        .get(term);
      return Number(row?.n ?? -1);
    };

    empty.raw.exec(`
      INSERT INTO record (id, person_id, date, kind, title, symptoms, created_at, updated_at)
        VALUES ('r1', 'p1', '2026-10-01', 'self_care', 'Synthetic migraine', '["synthetic nausea"]', 1, 1);
    `);
    expect(matches('migraine')).toBe(1);

    empty.raw.exec("UPDATE record SET title = 'Synthetic backache' WHERE id = 'r1'");
    expect(matches('migraine')).toBe(0);
    expect(matches('backache')).toBe(1);

    empty.raw.exec("DELETE FROM record WHERE id = 'r1'");
    expect(matches('backache')).toBe(0);
    empty.close();
  });
});

describe('v3 profile exclusion flags', () => {
  it('adds the column to existing rows and leaves them counting for the profile', () => {
    // A phone that upgraded: measurements and medications written before v3 must not be taken out
    // of the profile by the new default.
    const { raw, migrations, close } = databaseAtVersion(2);
    seedPerson(raw);
    raw
      .prepare(
        `INSERT INTO measurement (id, person_id, kind, v1, measured_on, created_at)
         VALUES ('mm1', 'p1', 'weight', 70, '2026-10-01', 1)`,
      )
      .run();
    raw
      .prepare(
        `INSERT INTO medication (id, person_id, name, start_on, status)
         VALUES ('mg1', 'p1', 'Synthetic Amoxicillin', '2026-10-01', 'ongoing')`,
      )
      .run();

    expect(runMigrations(migrations)).toEqual({ ok: true, value: LATEST_SCHEMA_VERSION });

    expect(raw.prepare('SELECT profile_excluded FROM measurement').get()).toEqual({
      profile_excluded: 0,
    });
    expect(raw.prepare('SELECT profile_excluded FROM medication').get()).toEqual({
      profile_excluded: 0,
    });
    close();
  });
});

describe('re-running migrations', () => {
  it('is a no-op and preserves data', () => {
    const empty = createEmptyTestDatabase();
    const migrations = createMigrationDatabase(empty.client);
    runMigrations(migrations);
    seedPerson(empty.raw);

    expect(runMigrations(migrations)).toEqual({ ok: true, value: LATEST_SCHEMA_VERSION });
    expect(empty.raw.prepare('SELECT COUNT(*) AS n FROM person').get()).toEqual({ n: 1 });
    empty.close();
  });
});

describe('version guard', () => {
  it('refuses a database written by a newer app version', () => {
    const empty = createEmptyTestDatabase();
    empty.raw.exec(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 1}`);

    const result = runMigrations(createMigrationDatabase(empty.client));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DB_FAILURE');
    empty.close();
  });

  it('refuses a non-integer version instead of interpolating it', () => {
    const empty = createEmptyTestDatabase();
    const migrations = createMigrationDatabase(empty.client);
    expect(() => migrations.setUserVersion(1.5)).toThrow(/non-integer/);
    empty.close();
  });
});
