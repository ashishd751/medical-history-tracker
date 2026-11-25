/**
 * People. Phase 1 creates exactly one through onboarding, but every query in the app is
 * already person-scoped so a second family member needs no schema change (FR-15).
 */
import { asc, eq } from 'drizzle-orm';

import type { BloodType, Sex } from '../../domain';
import { type AppError, appError } from '../../lib/errors';
import { err, ok, type Result } from '../../lib/result';
import type { AppDatabase } from '../db';
import { person, type PersonRow } from '../schema';
import { defaultRepositoryDeps, type RepositoryDeps } from './deps';

export interface NewPersonInput {
  readonly name: string;
  /** `YYYY-MM-DD`. */
  readonly dob: string;
  readonly sex: Sex;
  readonly bloodType?: BloodType | null;
  readonly allergies?: string | null;
  readonly chronicConditions?: string | null;
}

export interface PersonPatch {
  readonly name?: string;
  readonly dob?: string;
  readonly sex?: Sex;
  readonly bloodType?: BloodType | null;
  readonly allergies?: string | null;
  readonly chronicConditions?: string | null;
}

export interface PersonRepository {
  create(input: NewPersonInput): Result<PersonRow, AppError>;
  update(id: string, patch: PersonPatch): Result<PersonRow, AppError>;
  getById(id: string): PersonRow | null;
  /** The single-family default: the oldest person row. */
  getFirst(): PersonRow | null;
  list(): PersonRow[];
  count(): number;
  /** Deletes the person and, by cascade, all of their records and measurements. */
  remove(id: string): Result<true, AppError>;
}

export function createPersonRepository(
  db: AppDatabase,
  deps: RepositoryDeps = defaultRepositoryDeps,
): PersonRepository {
  const getById = (id: string): PersonRow | null =>
    db.select().from(person).where(eq(person.id, id)).get() ?? null;
  const getFirst = (): PersonRow | null =>
    db.select().from(person).orderBy(asc(person.createdAt), asc(person.id)).get() ?? null;

  return {
    create(input) {
      const now = deps.now();
      const row: PersonRow = {
        id: deps.newId(),
        name: input.name,
        dob: input.dob,
        sex: input.sex,
        bloodType: input.bloodType ?? null,
        allergies: input.allergies ?? null,
        chronicConditions: input.chronicConditions ?? null,
        createdAt: now,
        updatedAt: now,
      };
      try {
        db.transaction((tx) => {
          tx.insert(person).values(row).run();
        });
        return ok(row);
      } catch (error) {
        return err(appError('DB_FAILURE', 'Could not save the person.', error));
      }
    },

    update(id, patch) {
      try {
        const changes: Partial<PersonRow> = { updatedAt: deps.now() };
        if (patch.name !== undefined) changes.name = patch.name;
        if (patch.dob !== undefined) changes.dob = patch.dob;
        if (patch.sex !== undefined) changes.sex = patch.sex;
        if (patch.bloodType !== undefined) changes.bloodType = patch.bloodType;
        if (patch.allergies !== undefined) changes.allergies = patch.allergies;
        if (patch.chronicConditions !== undefined) {
          changes.chronicConditions = patch.chronicConditions;
        }

        let updated: PersonRow | null = null;
        db.transaction((tx) => {
          tx.update(person).set(changes).where(eq(person.id, id)).run();
          updated = tx.select().from(person).where(eq(person.id, id)).get() ?? null;
        });
        if (!updated) return err(appError('DB_FAILURE', `No person with id ${id}.`));
        return ok(updated);
      } catch (error) {
        return err(appError('DB_FAILURE', 'Could not update the person.', error));
      }
    },

    getById,
    getFirst,

    list: () => db.select().from(person).orderBy(asc(person.createdAt), asc(person.id)).all(),

    count: () => {
      const row = db.select({ n: person.id }).from(person).all();
      return row.length;
    },

    remove(id) {
      try {
        db.transaction((tx) => {
          tx.delete(person).where(eq(person.id, id)).run();
        });
        return ok(true);
      } catch (error) {
        return err(appError('DB_FAILURE', 'Could not delete the person.', error));
      }
    },
  };
}
