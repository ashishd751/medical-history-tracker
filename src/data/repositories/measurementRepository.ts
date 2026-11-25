/**
 * Measurements: height, weight, blood pressure, pulse, temperature, SpO2 and glucose.
 *
 * Values are stored in canonical metric units. The profile snapshot Home shows is derived from
 * the latest row per kind, never from a stored copy (section 9 of the project brief).
 */
import { and, desc, eq } from 'drizzle-orm';

import type { MeasurementKind } from '../../domain';
import { type AppError, appError } from '../../lib/errors';
import { err, ok, type Result } from '../../lib/result';
import type { AppDatabase } from '../db';
import { measurement, type MeasurementRow } from '../schema';
import { defaultRepositoryDeps, type RepositoryDeps } from './deps';

export interface MeasurementInput {
  readonly kind: MeasurementKind;
  readonly v1: number;
  readonly v2?: number | null;
  /** `YYYY-MM-DD`. */
  readonly measuredOn: string;
  readonly recordId?: string | null;
}

export interface VitalSnapshot {
  readonly height: MeasurementRow | null;
  readonly weight: MeasurementRow | null;
  readonly bloodPressure: MeasurementRow | null;
}

export interface MeasurementRepository {
  create(personId: string, input: MeasurementInput): Result<MeasurementRow, AppError>;
  /** The most recent row of a kind, ordered by date then insertion. */
  latest(personId: string, kind: MeasurementKind): MeasurementRow | null;
  latestVitals(personId: string): VitalSnapshot;
  listByKind(personId: string, kind: MeasurementKind, limit?: number): MeasurementRow[];
  remove(personId: string, id: string): Result<true, AppError>;
}

export function createMeasurementRepository(
  db: AppDatabase,
  deps: RepositoryDeps = defaultRepositoryDeps,
): MeasurementRepository {
  const latest = (personId: string, kind: MeasurementKind): MeasurementRow | null =>
    db
      .select()
      .from(measurement)
      .where(and(eq(measurement.personId, personId), eq(measurement.kind, kind)))
      .orderBy(desc(measurement.measuredOn), desc(measurement.createdAt), desc(measurement.id))
      .limit(1)
      .get() ?? null;

  return {
    create(personId, input) {
      if (!Number.isFinite(input.v1)) {
        return err(appError('DB_FAILURE', 'A measurement needs a numeric value.'));
      }
      const row: MeasurementRow = {
        id: deps.newId(),
        personId,
        recordId: input.recordId ?? null,
        kind: input.kind,
        v1: input.v1,
        v2: input.v2 ?? null,
        measuredOn: input.measuredOn,
        createdAt: deps.now(),
      };
      try {
        db.transaction((tx) => {
          tx.insert(measurement).values(row).run();
        });
        return ok(row);
      } catch (error) {
        return err(appError('DB_FAILURE', 'Could not save the measurement.', error));
      }
    },

    latest,

    latestVitals: (personId) => ({
      height: latest(personId, 'height'),
      weight: latest(personId, 'weight'),
      bloodPressure: latest(personId, 'bp'),
    }),

    listByKind: (personId, kind, limit = 50) =>
      db
        .select()
        .from(measurement)
        .where(and(eq(measurement.personId, personId), eq(measurement.kind, kind)))
        .orderBy(desc(measurement.measuredOn), desc(measurement.createdAt), desc(measurement.id))
        .limit(limit)
        .all(),

    remove(personId, id) {
      try {
        db.transaction((tx) => {
          tx.delete(measurement)
            .where(and(eq(measurement.id, id), eq(measurement.personId, personId)))
            .run();
        });
        return ok(true);
      } catch (error) {
        return err(appError('DB_FAILURE', 'Could not delete the measurement.', error));
      }
    },
  };
}
