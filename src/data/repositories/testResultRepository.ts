/**
 * Lab readings.
 *
 * A reading never exists without its record, so writes happen inside
 * `recordRepository`'s transaction. This repository is the person-scoped read side: the join
 * through `record` is what stops one family member's readings leaking into another's view.
 */
import { and, asc, eq, getTableColumns, sql } from 'drizzle-orm';

import type { AppDatabase } from '../db';
import { record, testResult, type TestResultRow } from '../schema';

export interface TestResultRepository {
  listForRecord(personId: string, recordId: string): TestResultRow[];
  countForPerson(personId: string): number;
}

const columns = getTableColumns(testResult);

export function createTestResultRepository(db: AppDatabase): TestResultRepository {
  return {
    listForRecord: (personId, recordId) =>
      db
        .select(columns)
        .from(testResult)
        .innerJoin(record, eq(record.id, testResult.recordId))
        .where(and(eq(testResult.recordId, recordId), eq(record.personId, personId)))
        .orderBy(asc(testResult.id))
        .all(),

    countForPerson(personId) {
      const row = db
        .select({ n: sql<number>`count(*)` })
        .from(testResult)
        .innerJoin(record, eq(record.id, testResult.recordId))
        .where(eq(record.personId, personId))
        .get();
      return Number(row?.n ?? 0);
    },
  };
}
