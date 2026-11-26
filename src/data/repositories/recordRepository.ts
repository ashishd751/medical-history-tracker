/**
 * Records and their children.
 *
 * A record form saves a record, its medications, its test readings and its vitals in ONE
 * transaction: a partial save would leave a lab report with half its readings. Transactions use
 * synchronous callbacks deliberately (ADR-020) — an async callback commits before it throws.
 */
import { and, asc, desc, eq, gte, inArray, lte, type SQL, sql } from 'drizzle-orm';

import type {
  DataSource,
  MeasurementKind,
  MedicationStatus,
  ReadingFlag,
  RecordKind,
} from '../../domain';
import { type AppError, appError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { err, ok, type Result } from '../../lib/result';
import type { AppDatabase } from '../db';
import {
  attachment,
  type AttachmentRow,
  measurement,
  type MeasurementRow,
  medication,
  type MedicationRow,
  record,
  type RecordRow,
  testResult,
  type TestResultRow,
} from '../schema';
import { type AttachmentInput, attachmentPathsOf, insertAttachments } from './attachmentRepository';
import { defaultRepositoryDeps, type RepositoryDeps } from './deps';

export interface MedicationInput {
  readonly name: string;
  readonly dose?: string;
  readonly frequency?: string;
  readonly duration?: string;
  /** Defaults to the record's date. */
  readonly startOn?: string;
  readonly endOn?: string | null;
  readonly status?: MedicationStatus;
  readonly notes?: string;
  readonly source?: DataSource;
}

export interface ReadingInput {
  readonly name: string;
  readonly value: string;
  readonly numericValue?: number | null;
  readonly unit?: string;
  readonly refLow?: number | null;
  readonly refHigh?: number | null;
  readonly flag?: ReadingFlag;
}

export interface VitalInput {
  readonly kind: MeasurementKind;
  readonly v1: number;
  readonly v2?: number | null;
}

export interface RecordFormInput {
  /**
   * Optional record id.
   *
   * The form supplies one for a new record because attachment paths contain the record id, so the
   * files are already in place before the rows are written (ADR-030). Without it the repository
   * generates an id as before.
   */
  readonly id?: string;
  /** `YYYY-MM-DD`. */
  readonly date: string;
  readonly kind: RecordKind;
  readonly title: string;
  readonly symptoms?: readonly string[];
  readonly condition?: string;
  readonly doctorId?: string | null;
  readonly facility?: string;
  readonly prescriptionText?: string;
  readonly comments?: string;
  /** `YYYY-MM-DD` or null. */
  readonly followUpOn?: string | null;
  readonly medications?: readonly MedicationInput[];
  readonly readings?: readonly ReadingInput[];
  readonly vitals?: readonly VitalInput[];
  /** Attachment rows to write in the same transaction, files already moved into place. */
  readonly attachments?: readonly AttachmentInput[];
  /** Attachment rows to delete in the same transaction (edit only). */
  readonly removedAttachmentIds?: readonly string[];
}

export type RecordView = Omit<RecordRow, 'symptoms'> & { readonly symptoms: readonly string[] };

export interface RecordSummary {
  readonly id: string;
  readonly date: string;
  readonly kind: RecordKind;
  readonly title: string;
  readonly condition: string;
  readonly doctorId: string | null;
  readonly followUpOn: string | null;
  readonly updatedAt: number;
}

export interface RecordDetail {
  readonly record: RecordView;
  readonly medications: readonly MedicationRow[];
  readonly readings: readonly TestResultRow[];
  readonly measurements: readonly MeasurementRow[];
  readonly attachments: readonly AttachmentRow[];
}

/** What deleting a record leaves for the caller to clean up on disk (ADR-030). */
export interface RecordRemoval {
  /** Relative paths of the deleted attachments' files and thumbnails. */
  readonly attachmentPaths: readonly string[];
}

export interface RecordFilter {
  readonly search?: string;
  readonly kinds?: readonly RecordKind[];
  /** Inclusive `YYYY-MM-DD`. */
  readonly from?: string;
  /** Inclusive `YYYY-MM-DD`. */
  readonly to?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface RecordPage {
  readonly items: readonly RecordSummary[];
  readonly hasMore: boolean;
}

export interface RecordRepository {
  create(personId: string, input: RecordFormInput): Result<string, AppError>;
  update(personId: string, recordId: string, input: RecordFormInput): Result<true, AppError>;
  getDetail(personId: string, recordId: string): RecordDetail | null;
  listSummaries(personId: string, filter?: RecordFilter): RecordSummary[];
  /** One page of the timeline, plus whether another page exists (ADR-024). */
  listPage(personId: string, filter: RecordFilter, limit: number, offset: number): RecordPage;
  recent(personId: string, limit?: number): RecordSummary[];
  /** Total matches for the filters, using the same predicate as the list (ADR-024). */
  count(personId: string, filter?: RecordFilter): number;
  /** Cascades to medications, readings and attachments; returns the files to delete. */
  remove(personId: string, recordId: string): Result<RecordRemoval, AppError>;
}

/** Symptoms are a JSON array in storage; a damaged value must not break a whole list read. */
export function parseSymptoms(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    logger.warn('Discarding unreadable symptoms value', { value });
    return [];
  }
}

export function toRecordView(row: RecordRow): RecordView {
  const { symptoms, ...rest } = row;
  return { ...rest, symptoms: parseSymptoms(symptoms) };
}

/** Safety cap for callers that ask for a list without paging (Home's recent records, tests). */
export const DEFAULT_PAGE_LIMIT = 50;

/** The transaction handle Drizzle hands to a synchronous transaction callback. */
type AppTransaction = Parameters<Parameters<AppDatabase['transaction']>[0]>[0];

export function createRecordRepository(
  db: AppDatabase,
  deps: RepositoryDeps = defaultRepositoryDeps,
): RecordRepository {
  const ownedRecord = (personId: string, recordId: string): RecordRow | null =>
    db
      .select()
      .from(record)
      .where(and(eq(record.id, recordId), eq(record.personId, personId)))
      .get() ?? null;

  const insertChildren = (
    tx: AppTransaction,
    personId: string,
    recordId: string,
    input: RecordFormInput,
    now: number,
  ): void => {
    for (const item of input.medications ?? []) {
      if (!item.name.trim()) continue;
      tx.insert(medication)
        .values({
          id: deps.newId(),
          personId,
          recordId,
          name: item.name.trim(),
          dose: item.dose?.trim() ?? '',
          frequency: item.frequency?.trim() ?? '',
          duration: item.duration?.trim() ?? '',
          startOn: item.startOn ?? input.date,
          endOn: item.endOn ?? null,
          status: item.status ?? 'ongoing',
          notes: item.notes?.trim() ?? '',
          source: item.source ?? 'manual',
          reviewedAt: now,
        })
        .run();
    }

    for (const item of input.readings ?? []) {
      if (!item.name.trim() || !item.value.trim()) continue;
      tx.insert(testResult)
        .values({
          id: deps.newId(),
          recordId,
          name: item.name.trim(),
          value: item.value.trim(),
          numericValue: item.numericValue ?? null,
          unit: item.unit?.trim() ?? '',
          refLow: item.refLow ?? null,
          refHigh: item.refHigh ?? null,
          flag: item.flag ?? 'unknown',
          source: 'manual',
          reviewedAt: now,
        })
        .run();
    }

    for (const item of input.vitals ?? []) {
      if (!Number.isFinite(item.v1)) continue;
      tx.insert(measurement)
        .values({
          id: deps.newId(),
          personId,
          recordId,
          kind: item.kind,
          v1: item.v1,
          v2: item.v2 ?? null,
          measuredOn: input.date,
          createdAt: now,
        })
        .run();
    }
  };

  const listSummaries = (personId: string, filter?: RecordFilter): RecordSummary[] => {
    const conditions = filterConditions(personId, filter);

    return db
      .select({
        id: record.id,
        date: record.date,
        kind: record.kind,
        title: record.title,
        condition: record.condition,
        doctorId: record.doctorId,
        followUpOn: record.followUpOn,
        updatedAt: record.updatedAt,
      })
      .from(record)
      .where(and(...conditions))
      .orderBy(desc(record.date), desc(record.createdAt), desc(record.id))
      .limit(filter?.limit ?? DEFAULT_PAGE_LIMIT)
      .offset(filter?.offset ?? 0)
      .all();
  };

  /**
   * The search predicate.
   *
   * Three or more characters go through the FTS5 trigram index, which is what keeps symptom
   * search fast once the timeline holds years of records (ADR-023). Shorter needles fall back to
   * `instr`, because the trigram tokenizer cannot match fewer than three characters — and a
   * one- or two-letter query is cheap and rare.
   *
   * A doctor's name is matched through a subquery instead of being copied into the index: the
   * doctor table is tiny, and renaming a doctor must not require re-indexing every record.
   */
  const searchCondition = (needle: string): SQL => {
    const doctorMatch = sql`exists (
      select 1 from doctor d
      where d.id = ${record.doctorId} and instr(lower(d.name), ${needle}) > 0
    )`;

    if (needle.length < 3) {
      // Symptoms are a JSON array in storage. A naive `instr` over the raw column would match the
      // JSON syntax itself — searching `"` would return every record with any symptom — so the
      // fallback walks the decoded array instead. `json_valid` keeps a damaged value from turning
      // one bad row into a failed search (parseSymptoms is just as forgiving).
      const symptomMatch = sql`exists (
        select 1 from json_each(
          case when json_valid(${record.symptoms}) then ${record.symptoms} else '[]' end
        )
        where instr(lower(json_each.value), ${needle}) > 0
      )`;

      // `instr` is a literal substring test: a stray `%` typed into search cannot widen the match.
      return sql`(
        instr(lower(${record.title}), ${needle}) > 0 OR
        instr(lower(${record.condition}), ${needle}) > 0 OR
        ${symptomMatch} OR
        instr(lower(${record.facility}), ${needle}) > 0 OR
        instr(lower(${record.prescriptionText}), ${needle}) > 0 OR
        instr(lower(${record.comments}), ${needle}) > 0 OR
        ${doctorMatch}
      )`;
    }

    // Quoting turns the user's words into a single FTS phrase, so punctuation and `AND`/`OR`
    // cannot turn a search box into a query-syntax error.
    const phrase = `"${needle.replace(/"/g, '""')}"`;
    // The subquery returns index rowids, and the caller's `WHERE` already scopes the person.
    // Joining `record` inside the subquery instead lets SQLite drive from the person index and
    // probe the FTS table once per row — measured at ~440 ms for a rare term on 10,000 records,
    // versus ~0.3 ms in this shape (ADR-023).
    return sql`(
      record.rowid in (
        select rowid from record_fts where record_fts match ${phrase}
      ) OR ${doctorMatch}
    )`;
  };

  /**
   * The shared WHERE clauses.
   *
   * `count` must see exactly what the list sees, or the header would disagree with the rows
   * (ADR-024). Limit and offset belong to the list, so they are not part of this predicate.
   */
  const filterConditions = (personId: string, filter?: RecordFilter): SQL[] => {
    const conditions: SQL[] = [eq(record.personId, personId)];
    if (filter?.from) conditions.push(gte(record.date, filter.from));
    if (filter?.to) conditions.push(lte(record.date, filter.to));
    if (filter?.kinds && filter.kinds.length > 0) {
      conditions.push(inArray(record.kind, [...filter.kinds]));
    }

    const needle = filter?.search?.trim().toLowerCase();
    if (needle) {
      conditions.push(searchCondition(needle));
    }
    return conditions;
  };

  return {
    create(personId, input) {
      const now = deps.now();
      const id = input.id ?? deps.newId();
      try {
        db.transaction((tx) => {
          tx.insert(record)
            .values({
              id,
              personId,
              date: input.date,
              kind: input.kind,
              title: input.title.trim(),
              symptoms: JSON.stringify(input.symptoms ?? []),
              condition: input.condition?.trim() ?? '',
              doctorId: input.doctorId ?? null,
              facility: input.facility?.trim() ?? '',
              prescriptionText: input.prescriptionText?.trim() ?? '',
              comments: input.comments?.trim() ?? '',
              followUpOn: input.followUpOn ?? null,
              createdAt: now,
              updatedAt: now,
            })
            .run();
          insertChildren(tx, personId, id, input, now);
          insertAttachments(tx, id, input.attachments ?? [], now);
        });
        return ok(id);
      } catch (error) {
        return err(appError('DB_FAILURE', 'Could not save the record.', error));
      }
    },

    update(personId, recordId, input) {
      if (!ownedRecord(personId, recordId)) {
        return err(appError('DB_FAILURE', `No record ${recordId} for this person.`));
      }
      const now = deps.now();
      try {
        db.transaction((tx) => {
          tx.update(record)
            .set({
              date: input.date,
              kind: input.kind,
              title: input.title.trim(),
              symptoms: JSON.stringify(input.symptoms ?? []),
              condition: input.condition?.trim() ?? '',
              doctorId: input.doctorId ?? null,
              facility: input.facility?.trim() ?? '',
              prescriptionText: input.prescriptionText?.trim() ?? '',
              comments: input.comments?.trim() ?? '',
              followUpOn: input.followUpOn ?? null,
              updatedAt: now,
            })
            .where(and(eq(record.id, recordId), eq(record.personId, personId)))
            .run();

          // Children are replaced wholesale: the form holds the complete set, and a diff would
          // leave stale readings behind whenever a row was cleared.
          tx.delete(medication).where(eq(medication.recordId, recordId)).run();
          tx.delete(testResult).where(eq(testResult.recordId, recordId)).run();
          tx.delete(measurement).where(eq(measurement.recordId, recordId)).run();
          insertChildren(tx, personId, recordId, input, now);

          // Attachments are additive: existing rows keep their ids (and therefore their files),
          // removed ones are deleted here, new ones are inserted.
          const removed = [...(input.removedAttachmentIds ?? [])];
          if (removed.length > 0) {
            tx.delete(attachment)
              .where(and(eq(attachment.recordId, recordId), inArray(attachment.id, removed)))
              .run();
          }
          insertAttachments(tx, recordId, input.attachments ?? [], now);
        });
        return ok(true);
      } catch (error) {
        return err(appError('DB_FAILURE', 'Could not update the record.', error));
      }
    },

    getDetail(personId, recordId) {
      const row = ownedRecord(personId, recordId);
      if (!row) return null;
      return {
        record: toRecordView(row),
        medications: db
          .select()
          .from(medication)
          .where(eq(medication.recordId, recordId))
          .orderBy(asc(medication.id))
          .all(),
        readings: db
          .select()
          .from(testResult)
          .where(eq(testResult.recordId, recordId))
          .orderBy(asc(testResult.id))
          .all(),
        measurements: db
          .select()
          .from(measurement)
          .where(eq(measurement.recordId, recordId))
          .orderBy(asc(measurement.kind), asc(measurement.id))
          .all(),
        attachments: db
          .select()
          .from(attachment)
          .where(eq(attachment.recordId, recordId))
          .orderBy(asc(attachment.createdAt), asc(attachment.id))
          .all(),
      };
    },

    listSummaries,

    listPage(personId, filter, limit, offset) {
      // One extra row tells us whether another page exists without a second count query.
      const rows = listSummaries(personId, { ...filter, limit: limit + 1, offset });
      return { items: rows.slice(0, limit), hasMore: rows.length > limit };
    },

    recent: (personId, limit = 5) => listSummaries(personId, { limit }),

    count(personId, filter) {
      const row = db
        .select({ n: sql<number>`count(*)` })
        .from(record)
        .where(and(...filterConditions(personId, filter)))
        .get();
      return Number(row?.n ?? 0);
    },

    remove(personId, recordId) {
      if (!ownedRecord(personId, recordId)) {
        return err(appError('DB_FAILURE', `No record ${recordId} for this person.`));
      }
      try {
        let attachmentPaths: string[] = [];
        db.transaction((tx) => {
          // Read the paths before the cascade removes the rows: the files outlive the transaction
          // and only the caller can delete them.
          const rows = tx
            .select({ relPath: attachment.relPath, thumbRelPath: attachment.thumbRelPath })
            .from(attachment)
            .where(eq(attachment.recordId, recordId))
            .all();
          attachmentPaths = rows.flatMap(attachmentPathsOf);
          tx.delete(record)
            .where(and(eq(record.id, recordId), eq(record.personId, personId)))
            .run();
        });
        return ok({ attachmentPaths });
      } catch (error) {
        return err(appError('DB_FAILURE', 'Could not delete the record.', error));
      }
    },
  };
}
