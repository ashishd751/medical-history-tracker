/**
 * @jest-environment node
 *
 * Schema drift guard (ADR-018): the migrated SQL and the Drizzle definitions must describe the
 * same tables, columns, types, indexes and nullability. Without this, a hand-edited migration
 * could silently disagree with every query in the repositories.
 */
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';

import {
  appSetting,
  attachment,
  doctor,
  measurement,
  medication,
  person,
  record,
  testResult,
} from './schema';
import { createTestDatabase } from './testing/testDatabase';

const TABLES: readonly SQLiteTable[] = [
  person,
  doctor,
  record,
  medication,
  testResult,
  measurement,
  attachment,
  appSetting,
];

/** Drizzle column type → the SQLite type the migration must declare. */
function sqlTypeFor(columnType: string): string {
  switch (columnType) {
    case 'SQLiteText':
      return 'TEXT';
    case 'SQLiteInteger':
    case 'SQLiteBoolean':
      return 'INTEGER';
    case 'SQLiteReal':
      return 'REAL';
    default:
      return columnType;
  }
}

interface PragmaColumn {
  readonly name: string;
  readonly type: string;
  readonly notnull: number;
  readonly pk: number;
}

const tableNames = TABLES.map((table) => getTableConfig(table).name);

describe('schema drift', () => {
  it('covers every table the migration creates, and no others', () => {
    const db = createTestDatabase();
    const created = db.raw
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'record_fts%'`,
      )
      .all()
      .map((row) => String(row.name))
      .sort();

    expect(created).toEqual([...tableNames].sort());
    db.close();
  });

  it.each(tableNames)('%s has exactly the declared columns and types', (tableName) => {
    const table = TABLES.find((candidate) => getTableConfig(candidate).name === tableName);
    if (!table) throw new Error(`No schema definition for table ${tableName}`);

    const db = createTestDatabase();
    const pragma = db.raw
      .prepare(`PRAGMA table_info(${tableName})`)
      .all() as unknown as PragmaColumn[];
    const declared = Object.values(getTableColumns(table));
    const byName = new Map(pragma.map((column) => [column.name, column]));

    expect([...byName.keys()].sort()).toEqual(declared.map((column) => column.name).sort());

    for (const column of declared) {
      const migrated = byName.get(column.name);
      expect({ column: column.name, type: migrated?.type }).toEqual({
        column: column.name,
        type: sqlTypeFor(column.columnType),
      });
      if (column.notNull) {
        // The database may be stricter than Drizzle, never looser.
        expect({ column: column.name, notNull: migrated?.notnull }).toEqual({
          column: column.name,
          notNull: 1,
        });
      }
    }

    const primaryKeys = pragma.filter((column) => column.pk > 0);
    expect(primaryKeys).toHaveLength(1);
    expect(primaryKeys[0]?.name).toBe(tableName === 'app_setting' ? 'key' : 'id');
    db.close();
  });

  it.each(tableNames)('%s has exactly the declared indexes', (tableName) => {
    const table = TABLES.find((candidate) => getTableConfig(candidate).name === tableName);
    if (!table) throw new Error(`No schema definition for table ${tableName}`);

    const db = createTestDatabase();
    const declared = getTableConfig(table)
      .indexes.map((index) => index.config.name)
      .sort();
    const migrated = db.raw
      .prepare(`PRAGMA index_list(${tableName})`)
      .all()
      .filter((row) => row.origin === 'c')
      .map((row) => String(row.name))
      .sort();

    expect(migrated).toEqual(declared);
    db.close();
  });

  it('declares the cascade and set-null rules the repositories depend on', () => {
    const db = createTestDatabase();
    const foreignKeys = (tableName: string) =>
      db.raw
        .prepare(`PRAGMA foreign_key_list(${tableName})`)
        .all()
        .map((row) => ({
          from: String(row.from),
          table: String(row.table),
          onDelete: String(row.on_delete).toUpperCase(),
        }))
        .sort((a, b) => a.from.localeCompare(b.from));

    expect(foreignKeys('record')).toEqual([
      { from: 'doctor_id', table: 'doctor', onDelete: 'SET NULL' },
      { from: 'person_id', table: 'person', onDelete: 'CASCADE' },
    ]);
    expect(foreignKeys('medication')).toEqual([
      { from: 'person_id', table: 'person', onDelete: 'CASCADE' },
      { from: 'record_id', table: 'record', onDelete: 'CASCADE' },
    ]);
    expect(foreignKeys('test_result')).toEqual([
      { from: 'record_id', table: 'record', onDelete: 'CASCADE' },
    ]);
    expect(foreignKeys('attachment')).toEqual([
      { from: 'record_id', table: 'record', onDelete: 'CASCADE' },
    ]);
    expect(foreignKeys('measurement')).toEqual([
      { from: 'person_id', table: 'person', onDelete: 'CASCADE' },
      { from: 'record_id', table: 'record', onDelete: 'CASCADE' },
    ]);
    db.close();
  });
});
