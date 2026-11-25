/**
 * Deterministic repository fixture for the data tests.
 *
 * Ids are sequential so insertion order is obvious, and `now()` advances one millisecond per
 * call so `updatedAt` changes are observable.
 */
import type { Sex } from '../../domain';
import { type AppRepositories, createRepositories } from '../repositories/createRepositories';
import { createTestDatabase, type TestDatabase } from './testDatabase';

export interface RepositoryFixture {
  readonly database: TestDatabase;
  readonly repos: AppRepositories;
  readonly personId: string;
  /** Adds another person (for scoping tests) and returns their id. */
  addPerson(name: string, sex?: Sex): string;
  close(): void;
}

const BASE_TIME = 1_760_000_000_000;

export function createRepositoryFixture(): RepositoryFixture {
  const database = createTestDatabase();
  let counter = 0;
  const deps = {
    now: () => BASE_TIME + counter,
    newId: () => {
      counter += 1;
      return `00000000-0000-7000-8000-${String(counter).padStart(12, '0')}`;
    },
  };
  const repos = createRepositories(database.db, deps);

  const personResult = repos.people.create({
    name: 'Synthetic Person',
    dob: '1990-04-17',
    sex: 'female',
  });
  if (!personResult.ok) throw new Error(`Fixture person failed: ${personResult.error.detail}`);

  return {
    database,
    repos,
    personId: personResult.value.id,
    addPerson(name, sex = 'male') {
      const created = repos.people.create({ name, dob: '1985-11-02', sex });
      if (!created.ok) throw new Error(`Fixture person failed: ${created.error.detail}`);
      return created.value.id;
    },
    close: () => database.close(),
  };
}

/** Minimal valid record input; spread over it to test one field at a time. */
export function recordInput(
  overrides: Partial<Parameters<AppRepositories['records']['create']>[1]> = {},
): Parameters<AppRepositories['records']['create']>[1] {
  return {
    date: '2026-11-02',
    kind: 'doctor_visit',
    title: 'Synthetic check-up',
    symptoms: ['synthetic headache'],
    condition: 'Synthetic condition',
    facility: 'Synthetic Clinic',
    comments: 'Synthetic comment',
    ...overrides,
  };
}
