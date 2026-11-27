/**
 * App bootstrap: the query client and the session value.
 *
 * The repositories are synchronous (ADR-020), so the session can be read during the first
 * render. That is one small synchronous read of an already-open SQLite file; the only heavy
 * case is the very first launch, where migrations run before this returns.
 *
 * Only `app/_layout.tsx` imports this module — features consume `useSession()` from `lib` — so
 * it never becomes another feature's internal detail.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { getRepositories, sweepAttachmentsAtStartup } from '../../data';
import { DEFAULT_BMI_PRESET, DEFAULT_UNIT_SYSTEM } from '../../domain';
import type { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { SessionProvider, type SessionState } from '../../lib/session';
import { expoExportFiles } from '../../platform';
import { clearPreviousExportsAtStartup } from './exportCleanup';

interface SessionSnapshot {
  readonly ready: boolean;
  readonly error: AppError | null;
  readonly personId: string | null;
  readonly personName: string;
  readonly unitSystem: SessionState['unitSystem'];
  readonly bmiPreset: SessionState['bmiPreset'];
  readonly onboarded: boolean;
}

const EMPTY_SESSION: SessionSnapshot = {
  ready: true,
  error: null,
  personId: null,
  personName: '',
  unitSystem: DEFAULT_UNIT_SYSTEM,
  bmiPreset: DEFAULT_BMI_PRESET,
  onboarded: false,
};

function readSession(): SessionSnapshot {
  const repositories = getRepositories();
  if (!repositories.ok) return { ...EMPTY_SESSION, error: repositories.error };

  const { people, settings } = repositories.value;
  const stored = settings.getSettings();
  const active = stored.activePersonId ? people.getById(stored.activePersonId) : null;
  const person = active ?? people.getFirst();

  return {
    ready: true,
    error: null,
    personId: person?.id ?? null,
    personName: person?.name ?? '',
    unitSystem: stored.unitSystem,
    bmiPreset: stored.bmiPreset,
    // Onboarding counts as done only when both halves exist: a person row and the marker.
    onboarded: stored.onboardedAt !== null && person !== null,
  };
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // Reads are local SQLite queries, so a retry cannot help — it only delays the error.
          queries: { retry: false },
          mutations: { retry: false },
        },
      }),
  );
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(readSession);

  const refresh = useCallback(() => {
    setSnapshot(readSession());
    void queryClient.invalidateQueries();
  }, [queryClient]);

  // Reconcile files with rows in the background: the first screen renders while it runs, and a
  // failure is logged rather than shown (the store is unchanged, and the next launch retries).
  useEffect(() => {
    sweepAttachmentsAtStartup().catch((error: unknown) => {
      logger.warn('The startup attachment sweep failed', { error: String(error) });
    });
    // A PDF exported in an earlier session is a copy of medical data in the cache; it goes now
    // rather than waiting for the next export (ADR-049).
    clearPreviousExportsAtStartup({ files: expoExportFiles }).catch((error: unknown) => {
      logger.warn('The startup export cleanup failed', { error: String(error) });
    });
  }, []);

  const value = useMemo<SessionState>(() => ({ ...snapshot, refresh }), [snapshot, refresh]);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider value={value}>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
