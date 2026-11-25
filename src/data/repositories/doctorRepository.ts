/**
 * Doctors are a family-wide autocomplete list, not person-scoped: the phase spec's `doctor`
 * table has no `person_id`, and the same doctor usually sees more than one family member.
 * Deleting a doctor clears `record.doctor_id` (SET NULL) and never deletes a record.
 */
import { asc, eq, sql } from 'drizzle-orm';

import { type AppError, appError } from '../../lib/errors';
import { err, ok, type Result } from '../../lib/result';
import type { AppDatabase } from '../db';
import { doctor, type DoctorRow } from '../schema';
import { defaultRepositoryDeps, type RepositoryDeps } from './deps';

export interface DoctorInput {
  readonly name: string;
  readonly specialty?: string;
  readonly clinic?: string;
  readonly phone?: string;
}

export interface DoctorRepository {
  create(input: DoctorInput): Result<DoctorRow, AppError>;
  getById(id: string): DoctorRow | null;
  /** Case-insensitive contains search, ordered by name. */
  search(query: string, limit?: number): DoctorRow[];
  /** Exact, case-insensitive match on name. */
  findByName(name: string): DoctorRow | null;
  /** Returns the existing doctor for `name`, or creates one. */
  ensure(input: DoctorInput): Result<DoctorRow, AppError>;
  list(): DoctorRow[];
}

export function createDoctorRepository(
  db: AppDatabase,
  deps: RepositoryDeps = defaultRepositoryDeps,
): DoctorRepository {
  const findByName = (name: string): DoctorRow | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    return (
      db
        .select()
        .from(doctor)
        .where(sql`lower(trim(${doctor.name})) = lower(${trimmed})`)
        .get() ?? null
    );
  };

  return {
    create(input) {
      const row: DoctorRow = {
        id: deps.newId(),
        name: input.name.trim(),
        specialty: input.specialty?.trim() ?? '',
        clinic: input.clinic?.trim() ?? '',
        phone: input.phone?.trim() ?? '',
      };
      try {
        db.transaction((tx) => {
          tx.insert(doctor).values(row).run();
        });
        return ok(row);
      } catch (error) {
        return err(appError('DB_FAILURE', 'Could not save the doctor.', error));
      }
    },

    getById: (id) => db.select().from(doctor).where(eq(doctor.id, id)).get() ?? null,

    search(query, limit = 10) {
      const needle = query.trim().toLowerCase();
      if (!needle) {
        return db.select().from(doctor).orderBy(asc(doctor.name)).limit(limit).all();
      }
      return db
        .select()
        .from(doctor)
        .where(sql`instr(lower(${doctor.name}), ${needle}) > 0`)
        .orderBy(asc(doctor.name))
        .limit(limit)
        .all();
    },

    findByName,

    ensure(input) {
      const trimmed = input.name.trim();
      if (!trimmed) return err(appError('DB_FAILURE', 'A doctor needs a name.'));

      const existing = findByName(trimmed);
      if (existing) {
        // Fill in details the first save left blank, without overwriting anything.
        const fill: Partial<DoctorRow> = {};
        if (!existing.specialty && input.specialty?.trim()) fill.specialty = input.specialty.trim();
        if (!existing.clinic && input.clinic?.trim()) fill.clinic = input.clinic.trim();
        if (!existing.phone && input.phone?.trim()) fill.phone = input.phone.trim();
        if (Object.keys(fill).length === 0) return ok(existing);

        try {
          db.transaction((tx) => {
            tx.update(doctor).set(fill).where(eq(doctor.id, existing.id)).run();
          });
          return ok({ ...existing, ...fill });
        } catch (error) {
          return err(appError('DB_FAILURE', 'Could not update the doctor.', error));
        }
      }

      try {
        const row: DoctorRow = {
          id: deps.newId(),
          name: trimmed,
          specialty: input.specialty?.trim() ?? '',
          clinic: input.clinic?.trim() ?? '',
          phone: input.phone?.trim() ?? '',
        };
        db.transaction((tx) => {
          tx.insert(doctor).values(row).run();
        });
        return ok(row);
      } catch (error) {
        return err(appError('DB_FAILURE', 'Could not save the doctor.', error));
      }
    },

    list: () => db.select().from(doctor).orderBy(asc(doctor.name)).all(),
  };
}
