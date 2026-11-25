/**
 * Injected per repository so tests can freeze time and ids without touching global state.
 */
import { uuidv7 } from '../../lib/ids';

export interface RepositoryDeps {
  /** UTC epoch milliseconds. */
  readonly now: () => number;
  readonly newId: () => string;
}

export const defaultRepositoryDeps: RepositoryDeps = {
  now: () => Date.now(),
  newId: () => uuidv7(),
};

export function newRowId(deps: RepositoryDeps): string {
  return deps.newId();
}
