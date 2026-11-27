/**
 * Profile sync: what a record save, edit or delete did to the derived profile (Phase 3).
 *
 * The screens never build a diff themselves. They capture the profile before and after one write,
 * hand both snapshots here, and publish whatever comes back. Keeping the decision in one module
 * means create, edit and delete cannot drift apart (ADR-038, ADR-041).
 */
import type { AppRepositories, RecordDetail } from '@/data';
import {
  type BmiPreset,
  computeProfileDiff,
  type ProfileSnapshot,
  type ProfileUndoPlan,
} from '@/domain';
import type { ProfileChangeReport, ProfileUndoUnavailable } from '@/lib/profileChangeStore';

export interface ProfileReadRequest {
  readonly personId: string;
  /** The device's local calendar date, `YYYY-MM-DD`. */
  readonly today: string;
  readonly bmiPreset: BmiPreset;
}

/** Reads the profile from the one place that derives it. */
export function readProfile(
  repositories: AppRepositories,
  request: ProfileReadRequest,
): ProfileSnapshot | null {
  return repositories.profile.snapshot(request.personId, {
    today: request.today,
    bmiPreset: request.bmiPreset,
  });
}

/**
 * The rows a new record contributed, so Undo can take exactly them out of the profile.
 *
 * Rows already flagged are left alone: an undo must not claim credit for a row another undo
 * excluded.
 */
export function undoPlanForRecord(detail: RecordDetail | null): ProfileUndoPlan {
  return {
    measurementIds: (detail?.measurements ?? [])
      .filter((row) => !row.profileExcluded)
      .map((row) => row.id),
    medicationIds: (detail?.medications ?? [])
      .filter((row) => !row.profileExcluded)
      .map((row) => row.id),
  };
}

export interface ProfileChangeInput {
  readonly before: ProfileSnapshot | null;
  readonly after: ProfileSnapshot | null;
  readonly undo: ProfileUndoPlan | null;
  readonly undoUnavailable: ProfileUndoUnavailable | null;
}

/**
 * The report to show, or `null` when the profile did not move.
 *
 * `null` is the answer for a save that changed nothing, which includes a backdated record whose
 * measurement lost to a newer one: the history gained a row, the profile did not change, and no
 * sheet appears (section 4.1 of the phase brief).
 */
export function buildProfileChangeReport(input: ProfileChangeInput): ProfileChangeReport | null {
  if (!input.before || !input.after) return null;

  const changes = computeProfileDiff(input.before, input.after);
  if (changes.length === 0) return null;

  return { changes, undo: input.undo, undoUnavailable: input.undoUnavailable };
}
