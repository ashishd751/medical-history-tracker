/**
 * Medications.
 *
 * Writes that belong to a record go through `recordRepository` so the record and its children
 * commit together. This repository handles the standalone cases — onboarding's "current
 * medication" and editing a medication from the profile — plus the reads Home needs.
 */
import { and, desc, eq, gte, inArray, isNull, or } from 'drizzle-orm';

import { todayIso } from '../../lib/dates';
import { type AppError, appError } from '../../lib/errors';
import { err, ok, type Result } from '../../lib/result';
import type { AppDatabase } from '../db';
import { medication, type MedicationRow } from '../schema';
import { defaultRepositoryDeps, type RepositoryDeps } from './deps';
import type { MedicationInput } from './recordRepository';

export interface NewMedicationInput extends MedicationInput {
  readonly recordId?: string | null;
}

export interface MedicationPatch {
  readonly name?: string;
  readonly dose?: string;
  readonly frequency?: string;
  readonly duration?: string;
  readonly startOn?: string;
  readonly endOn?: string | null;
  readonly notes?: string;
}

export interface MedicationRepository {
  create(personId: string, input: NewMedicationInput): Result<MedicationRow, AppError>;
  update(personId: string, id: string, patch: MedicationPatch): Result<MedicationRow, AppError>;
  setStatus(
    personId: string,
    id: string,
    status: MedicationRow['status'],
  ): Result<MedicationRow, AppError>;
  /**
   * Current medication: `status = 'ongoing'`, not taken out of the profile by an undo, and either
   * open-ended or ending today or later. `today` is the device's local date (ADR-043); the rule is
   * the same one `isCurrentMedication` applies in the domain, and a test asserts they agree.
   */
  listCurrent(personId: string, today?: string): MedicationRow[];
  listForPerson(personId: string, limit?: number): MedicationRow[];
  /** Flags rows out of (or back into) the derived profile without deleting them (ADR-039). */
  setProfileExcluded(
    personId: string,
    ids: readonly string[],
    excluded: boolean,
  ): Result<number, AppError>;
  remove(personId: string, id: string): Result<true, AppError>;
}

export function createMedicationRepository(
  db: AppDatabase,
  deps: RepositoryDeps = defaultRepositoryDeps,
): MedicationRepository {
  const getOwned = (personId: string, id: string): MedicationRow | null =>
    db
      .select()
      .from(medication)
      .where(and(eq(medication.id, id), eq(medication.personId, personId)))
      .get() ?? null;

  return {
    create(personId, input) {
      const row: MedicationRow = {
        id: deps.newId(),
        personId,
        recordId: input.recordId ?? null,
        name: input.name.trim(),
        dose: input.dose?.trim() ?? '',
        frequency: input.frequency?.trim() ?? '',
        duration: input.duration?.trim() ?? '',
        startOn: input.startOn ?? todayIso(),
        endOn: input.endOn ?? null,
        status: input.status ?? 'ongoing',
        notes: input.notes?.trim() ?? '',
        source: input.source ?? 'manual',
        reviewedAt: deps.now(),
        profileExcluded: false,
      };
      if (!row.name) return err(appError('DB_FAILURE', 'A medication needs a name.'));
      try {
        db.transaction((tx) => {
          tx.insert(medication).values(row).run();
        });
        return ok(row);
      } catch (error) {
        return err(appError('DB_FAILURE', 'Could not save the medication.', error));
      }
    },

    update(personId, id, patch) {
      const existing = getOwned(personId, id);
      if (!existing) return err(appError('DB_FAILURE', `No medication ${id} for this person.`));

      const changes: Partial<MedicationRow> = {};
      if (patch.name !== undefined) changes.name = patch.name.trim();
      if (patch.dose !== undefined) changes.dose = patch.dose.trim();
      if (patch.frequency !== undefined) changes.frequency = patch.frequency.trim();
      if (patch.duration !== undefined) changes.duration = patch.duration.trim();
      if (patch.startOn !== undefined) changes.startOn = patch.startOn;
      if (patch.endOn !== undefined) changes.endOn = patch.endOn;
      if (patch.notes !== undefined) changes.notes = patch.notes.trim();

      try {
        db.transaction((tx) => {
          tx.update(medication)
            .set(changes)
            .where(and(eq(medication.id, id), eq(medication.personId, personId)))
            .run();
        });
        return ok({ ...existing, ...changes });
      } catch (error) {
        return err(appError('DB_FAILURE', 'Could not update the medication.', error));
      }
    },

    setStatus(personId, id, status) {
      const existing = getOwned(personId, id);
      if (!existing) return err(appError('DB_FAILURE', `No medication ${id} for this person.`));
      try {
        db.transaction((tx) => {
          tx.update(medication)
            .set({ status })
            .where(and(eq(medication.id, id), eq(medication.personId, personId)))
            .run();
        });
        return ok({ ...existing, status });
      } catch (error) {
        return err(appError('DB_FAILURE', 'Could not update the medication.', error));
      }
    },

    listCurrent: (personId, today = todayIso()) =>
      db
        .select()
        .from(medication)
        .where(
          and(
            eq(medication.personId, personId),
            eq(medication.status, 'ongoing'),
            eq(medication.profileExcluded, false),
            // A medication that ended before today is history, even while its status says
            // "ongoing": the end date is what the user actually recorded (ADR-043).
            or(isNull(medication.endOn), gte(medication.endOn, today)),
          ),
        )
        .orderBy(desc(medication.startOn), desc(medication.id))
        .all(),

    listForPerson: (personId, limit = 200) =>
      db
        .select()
        .from(medication)
        .where(eq(medication.personId, personId))
        .orderBy(desc(medication.startOn), desc(medication.id))
        .limit(limit)
        .all(),

    setProfileExcluded(personId, ids, excluded) {
      if (ids.length === 0) return ok(0);
      try {
        let changed = 0;
        db.transaction((tx) => {
          const result = tx
            .update(medication)
            .set({ profileExcluded: excluded })
            .where(and(eq(medication.personId, personId), inArray(medication.id, [...ids])))
            .run();
          changed = Number(result.changes);
        });
        return ok(changed);
      } catch (error) {
        return err(appError('DB_FAILURE', 'Could not update the medication.', error));
      }
    },

    remove(personId, id) {
      try {
        db.transaction((tx) => {
          tx.delete(medication)
            .where(and(eq(medication.id, id), eq(medication.personId, personId)))
            .run();
        });
        return ok(true);
      } catch (error) {
        return err(appError('DB_FAILURE', 'Could not delete the medication.', error));
      }
    },
  };
}
