/**
 * The derived profile as a read model, plus the one write it owns: undo (Phase 3).
 *
 * Screens must read the profile from here rather than assembling their own, so Home and Profile
 * can never disagree about what the newest value is (section 4.3 of the phase brief). Nothing is
 * stored: every call recomputes from the newest rows (section 4.1).
 */
import { and, eq, inArray } from 'drizzle-orm';

import {
  type BmiPreset,
  buildProfileSnapshot,
  type ProfileSnapshot,
  type ProfileUndoPlan,
} from '../../domain';
import { type AppError, appError } from '../../lib/errors';
import { err, ok, type Result } from '../../lib/result';
import type { AppDatabase } from '../db';
import { measurement, medication } from '../schema';
import type { MeasurementRepository } from './measurementRepository';
import type { MedicationRepository } from './medicationRepository';
import type { PersonRepository } from './personRepository';

export interface ProfileSnapshotOptions {
  /** The device's local calendar date, `YYYY-MM-DD`. */
  readonly today: string;
  readonly bmiPreset: BmiPreset;
}

/** The repositories the profile reads through; passed in so the queries cannot fork. */
export interface ProfileSources {
  readonly people: PersonRepository;
  readonly measurements: MeasurementRepository;
  readonly medications: MedicationRepository;
}

export interface ProfileRepository {
  /** The derived profile, or null when that person does not exist. */
  snapshot(personId: string, options: ProfileSnapshotOptions): ProfileSnapshot | null;
  /**
   * Takes the rows an undo plan names out of the profile. They stay on the record and in the
   * history, flagged as not counted (ADR-039).
   */
  undo(personId: string, plan: ProfileUndoPlan): Result<true, AppError>;
}

export function createProfileRepository(
  db: AppDatabase,
  sources: ProfileSources,
): ProfileRepository {
  return {
    snapshot(personId, { today, bmiPreset }) {
      const person = sources.people.getById(personId);
      if (!person) return null;

      const vitals = sources.measurements.latestVitals(personId);
      const bp = vitals.bloodPressure;

      return buildProfileSnapshot({
        heightCm: vitals.height?.v1 ?? null,
        weightKg: vitals.weight?.v1 ?? null,
        // A single-number BP row cannot be classified, so it is not the profile's blood pressure.
        bloodPressure:
          bp !== null && bp.v2 !== null
            ? { systolic: bp.v1, diastolic: bp.v2, measuredOn: bp.measuredOn }
            : null,
        bloodType: person.bloodType,
        medications: sources.medications
          .listCurrent(personId, today)
          .map((row) => ({ id: row.id, name: row.name })),
        bmiPreset,
      });
    },

    undo(personId, plan) {
      if (plan.measurementIds.length === 0 && plan.medicationIds.length === 0) return ok(true);
      try {
        db.transaction((tx) => {
          if (plan.measurementIds.length > 0) {
            tx.update(measurement)
              .set({ profileExcluded: true })
              .where(
                and(
                  eq(measurement.personId, personId),
                  inArray(measurement.id, [...plan.measurementIds]),
                ),
              )
              .run();
          }
          if (plan.medicationIds.length > 0) {
            tx.update(medication)
              .set({ profileExcluded: true })
              .where(
                and(
                  eq(medication.personId, personId),
                  inArray(medication.id, [...plan.medicationIds]),
                ),
              )
              .run();
          }
        });
        return ok(true);
      } catch (error) {
        return err(appError('DB_FAILURE', 'Could not undo the profile change.', error));
      }
    },
  };
}
