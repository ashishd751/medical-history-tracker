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
import { type ReactNode, useCallback, useMemo, useState } from 'react';

import { getRepositories } from '../../data';
import { DEFAULT_BMI_PRESET, DEFAULT_UNIT_SYSTEM } from '../../domain';
import type { AppError } from '../../lib/errors';
import { SessionProvider, type SessionState } from '../../lib/session';

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

  const value = useMemo<SessionState>(() => ({ ...snapshot, refresh }), [snapshot, refresh]);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider value={value}>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
