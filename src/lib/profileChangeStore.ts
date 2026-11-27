/**
 * The pending "Profile updated" change.
 *
 * A saved record navigates to its detail screen, and a deleted one goes back, so the change cannot
 * be held in the screen that produced it. It is therefore kept here: a module-level store read
 * through `useSyncExternalStore`, which is enough for one value and adds no dependency (ADR-040).
 *
 * It deliberately does **not** survive an app kill: the data is already committed, and a sheet that
 * reappeared days later would offer an undo the user no longer associates with anything.
 */
import { useSyncExternalStore } from 'react';

import type { ProfileChange, ProfileUndoPlan } from '../domain';

/** Why Undo is absent even though the profile changed (ADR-041). */
export type ProfileUndoUnavailable = 'edit' | 'delete';

export interface ProfileChangeReport {
  readonly changes: readonly ProfileChange[];
  /** Non-null only when Undo can revert the change exactly. */
  readonly undo: ProfileUndoPlan | null;
  readonly undoUnavailable: ProfileUndoUnavailable | null;
}

let pending: ProfileChangeReport | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Replaces the pending change; `null` closes the sheet and discards any earlier report. */
export function publishProfileChange(report: ProfileChangeReport | null): void {
  pending = report;
  notify();
}

export function dismissProfileChange(): void {
  publishProfileChange(null);
}

export function getProfileChange(): ProfileChangeReport | null {
  return pending;
}

export function subscribeToProfileChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useProfileChange(): ProfileChangeReport | null {
  return useSyncExternalStore(subscribeToProfileChange, getProfileChange, getProfileChange);
}
