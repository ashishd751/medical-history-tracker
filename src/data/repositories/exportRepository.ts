/**
 * The bulk loader behind the PDF export (Phase 4).
 *
 * The record screen reads one record at a time (`getDetail`); an export needs every record at once,
 * and calling `getDetail` per row would turn a 1,000-record export into thousands of queries.
 * Instead this module reads the records, then their medications, readings, measurements,
 * attachments and the doctors they mention in **six batched queries** — chunked at 500 ids because
 * SQLite's default limit on bound variables is 999 — and joins them in memory (ADR-048).
 *
 * There is deliberately no cap: `DEFAULT_PAGE_LIMIT` belongs to the timeline, not to a report. The
 * screen counts the same predicate through `records.count`, so the number it shows and the rows the
 * PDF receives cannot disagree.
 */
import { and, asc, desc, eq, gte, inArray, lte, type SQL } from 'drizzle-orm';

import type { AttachmentRole, RecordKind } from '../../domain';
import type { AppDatabase } from '../db';
import {
  attachment,
  doctor,
  measurement,
  type MeasurementRow,
  medication,
  type MedicationRow,
  record,
  type RecordRow,
  testResult,
  type TestResultRow,
} from '../schema';
import { toRecordView } from './recordRepository';

/** One `IN (…)` list never carries more ids than this. */
export const EXPORT_QUERY_CHUNK = 500;

export interface ExportRecordFilter {
  /** Inclusive `YYYY-MM-DD`. */
  readonly from?: string;
  /** Inclusive `YYYY-MM-DD`. */
  readonly to?: string;
  readonly kinds?: readonly RecordKind[];
}

/** A record with its children already attached; the shape the PDF formatter consumes. */
export interface ExportRecord {
  readonly id: string;
  readonly date: string;
  readonly kind: RecordKind;
  readonly title: string;
  readonly symptoms: readonly string[];
  readonly condition: string;
  readonly facility: string;
  readonly comments: string;
  readonly followUpOn: string | null;
  readonly createdAt: number;
  readonly doctorName: string | null;
  readonly medications: readonly MedicationRow[];
  readonly readings: readonly TestResultRow[];
  readonly measurements: readonly MeasurementRow[];
  /** Roles only: a stored file's name is an opaque id, so the role is what a reader can use. */
  readonly attachmentRoles: readonly AttachmentRole[];
}

export interface ExportRepository {
  /** Every matching record, newest first. Complete, never capped. */
  load(personId: string, filter?: ExportRecordFilter): ExportRecord[];
}

function chunked<T>(values: readonly T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += EXPORT_QUERY_CHUNK) {
    result.push(values.slice(index, index + EXPORT_QUERY_CHUNK));
  }
  return result;
}

/**
 * Groups child rows by their record id.
 *
 * The same helper serves every child table: each row's `recordId` is the key, and rows that point
 * at no record (a standalone measurement) are dropped — they cannot appear in a record's cell.
 */
function groupByRecord<T extends { readonly recordId: string | null }>(
  rows: readonly T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    if (row.recordId === null) continue;
    const bucket = grouped.get(row.recordId);
    if (bucket) bucket.push(row);
    else grouped.set(row.recordId, [row]);
  }
  return grouped;
}

function loadChildren<T extends { readonly recordId: string | null }>(
  recordIds: readonly string[],
  read: (chunk: readonly string[]) => T[],
): Map<string, T[]> {
  const merged = new Map<string, T[]>();
  for (const chunk of chunked(recordIds)) {
    for (const [recordId, rows] of groupByRecord(read(chunk))) {
      const existing = merged.get(recordId);
      if (existing) existing.push(...rows);
      else merged.set(recordId, rows);
    }
  }
  return merged;
}

export function createExportRepository(db: AppDatabase): ExportRepository {
  return {
    load(personId, filter) {
      const conditions: SQL[] = [eq(record.personId, personId)];
      if (filter?.from) conditions.push(gte(record.date, filter.from));
      if (filter?.to) conditions.push(lte(record.date, filter.to));
      if (filter?.kinds && filter.kinds.length > 0) {
        conditions.push(inArray(record.kind, [...filter.kinds]));
      }

      const rows: RecordRow[] = db
        .select()
        .from(record)
        .where(and(...conditions))
        .orderBy(desc(record.date), desc(record.createdAt), desc(record.id))
        .all();
      if (rows.length === 0) return [];

      const recordIds = rows.map((row) => row.id);

      // Doctors are family-wide, so only the ids these records mention are read.
      const doctorNames = new Map<string, string>();
      const doctorIds = [
        ...new Set(
          rows
            .map((row) => row.doctorId)
            .filter((value): value is string => value !== null && value !== ''),
        ),
      ];
      for (const chunk of chunked(doctorIds)) {
        const found = db
          .select({ id: doctor.id, name: doctor.name })
          .from(doctor)
          .where(inArray(doctor.id, chunk))
          .all();
        for (const entry of found) doctorNames.set(entry.id, entry.name);
      }

      const medications = loadChildren(recordIds, (chunk) =>
        db
          .select()
          .from(medication)
          .where(and(eq(medication.personId, personId), inArray(medication.recordId, chunk)))
          .orderBy(asc(medication.id))
          .all(),
      );
      const readings = loadChildren(recordIds, (chunk) =>
        db
          .select()
          .from(testResult)
          .where(inArray(testResult.recordId, chunk))
          .orderBy(asc(testResult.id))
          .all(),
      );
      const measurements = loadChildren(recordIds, (chunk) =>
        db
          .select()
          .from(measurement)
          .where(and(eq(measurement.personId, personId), inArray(measurement.recordId, chunk)))
          .orderBy(asc(measurement.kind), asc(measurement.id))
          .all(),
      );
      const attachments = loadChildren(recordIds, (chunk) =>
        db
          .select({ recordId: attachment.recordId, role: attachment.role })
          .from(attachment)
          .where(inArray(attachment.recordId, chunk))
          .orderBy(asc(attachment.createdAt), asc(attachment.id))
          .all(),
      );

      return rows.map((row) => {
        const view = toRecordView(row);
        return {
          id: view.id,
          date: view.date,
          kind: view.kind,
          title: view.title,
          symptoms: view.symptoms,
          condition: view.condition,
          facility: view.facility,
          comments: view.comments,
          followUpOn: view.followUpOn,
          createdAt: view.createdAt,
          doctorName: view.doctorId === null ? null : (doctorNames.get(view.doctorId) ?? null),
          medications: medications.get(view.id) ?? [],
          readings: readings.get(view.id) ?? [],
          measurements: measurements.get(view.id) ?? [],
          attachmentRoles: (attachments.get(view.id) ?? []).map((entry) => entry.role),
        };
      });
    },
  };
}
