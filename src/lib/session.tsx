/**
 * The session context.
 *
 * It lives in `lib` because it is the only layer that both feature screens and route files may
 * import: features must not import each other's internals, and `ui` must not reach into `data`.
 * The value is plain data — loading it happens in `features/shell/AppProviders`, which is wired
 * up once by `app/_layout.tsx`.
 */
import { createContext, type ReactNode, useContext } from 'react';

import type { BmiPreset, UnitSystem } from '../domain';
import type { AppError } from './errors';

export interface SessionState {
  /** True once the database has been opened and read. */
  readonly ready: boolean;
  /** Set when the database could not be opened or migrated; the UI shows a banner. */
  readonly error: AppError | null;
  readonly personId: string | null;
  readonly personName: string;
  readonly unitSystem: UnitSystem;
  readonly bmiPreset: BmiPreset;
  /** True once onboarding has written the person row and the settings row. */
  readonly onboarded: boolean;
  /** Re-reads the database after a write that changes the session (onboarding, settings). */
  readonly refresh: () => void;
}

const SessionContext = createContext<SessionState | null>(null);

export interface SessionProviderProps {
  value: SessionState;
  children: ReactNode;
}

export function SessionProvider({ value, children }: SessionProviderProps) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used inside SessionProvider (see app/_layout.tsx).');
  }
  return value;
}
