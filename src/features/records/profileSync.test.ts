/**
 * @jest-environment node
 *
 * Profile sync against real SQLite: a save, an edit, a delete and the store in between.
 */
import {
  createRepositoryFixture,
  recordInput,
  type RepositoryFixture,
} from '../../data/testing/repositoryFixture';
import {
  dismissProfileChange,
  getProfileChange,
  publishProfileChange,
  subscribeToProfileChange,
} from '../../lib/profileChangeStore';
import { buildProfileChangeReport, readProfile, undoPlanForRecord } from './profileSync';

const TODAY = '2026-11-27';

function request(fixture: RepositoryFixture) {
  return { personId: fixture.personId, today: TODAY, bmiPreset: 'asian' as const };
}

function capture(fixture: RepositoryFixture) {
  return readProfile(fixture.repos, request(fixture));
}

describe('buildProfileChangeReport', () => {
  it('lists the change a new record made and offers an undo plan for its rows', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.measurements.create(fixture.personId, {
      kind: 'height',
      v1: 170,
      measuredOn: '2026-01-01',
    });
    const before = capture(fixture);

    const created = fixture.repos.records.create(
      fixture.personId,
      recordInput({ id: 'r1', date: '2026-03-01', vitals: [{ kind: 'weight', v1: 70 }] }),
    );
    if (!created.ok) throw new Error('setup failed');

    const detail = fixture.repos.records.getDetail(fixture.personId, 'r1');
    const report = buildProfileChangeReport({
      before,
      after: capture(fixture),
      undo: undoPlanForRecord(detail),
      undoUnavailable: null,
    });

    expect(report?.changes).toEqual([
      { kind: 'weight', from: null, to: 70 },
      { kind: 'bmi', from: null, to: 24.2 },
    ]);
    expect(report?.undo?.measurementIds).toEqual(detail?.measurements.map((row) => row.id));
    expect(report?.undoUnavailable).toBeNull();

    // Undo is exact: the profile goes back to what it held before the record existed.
    if (!report?.undo) throw new Error('expected an undo plan');
    fixture.repos.profile.undo(fixture.personId, report.undo);
    expect(capture(fixture)).toEqual(before);
    fixture.close();
  });

  it('reports nothing for a backdated record that lost to a newer value', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.records.create(
      fixture.personId,
      recordInput({ id: 'r-new', date: '2026-03-01', vitals: [{ kind: 'weight', v1: 70 }] }),
    );
    const before = capture(fixture);

    fixture.repos.records.create(
      fixture.personId,
      recordInput({ id: 'r-old', date: '2025-12-01', vitals: [{ kind: 'weight', v1: 82 }] }),
    );

    const report = buildProfileChangeReport({
      before,
      after: capture(fixture),
      undo: undoPlanForRecord(fixture.repos.records.getDetail(fixture.personId, 'r-old')),
      undoUnavailable: null,
    });

    expect(report).toBeNull();
    // The value is still visible in the history, which is what the user asked for.
    expect(
      fixture.repos.measurements.listByKind(fixture.personId, 'weight').map((row) => row.v1),
    ).toEqual([70, 82]);
    fixture.close();
  });

  it('reports an edit without an undo plan', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.records.create(
      fixture.personId,
      recordInput({ id: 'r1', date: '2026-03-01', vitals: [{ kind: 'weight', v1: 70 }] }),
    );
    const before = capture(fixture);

    const updated = fixture.repos.records.update(
      fixture.personId,
      'r1',
      recordInput({ date: '2026-03-01', vitals: [{ kind: 'weight', v1: 73 }] }),
    );
    if (!updated.ok) throw new Error('update failed');

    const report = buildProfileChangeReport({
      before,
      after: capture(fixture),
      undo: null,
      undoUnavailable: 'edit',
    });

    expect(report?.changes).toEqual([{ kind: 'weight', from: 70, to: 73 }]);
    expect(report?.undo).toBeNull();
    expect(report?.undoUnavailable).toBe('edit');
    fixture.close();
  });

  it('reports a delete without an undo plan, and follows the profile down', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.records.create(
      fixture.personId,
      recordInput({ id: 'r-latest', date: '2026-03-01', vitals: [{ kind: 'weight', v1: 70 }] }),
    );
    fixture.repos.records.create(
      fixture.personId,
      recordInput({ id: 'r-older', date: '2025-12-01', vitals: [{ kind: 'weight', v1: 82 }] }),
    );

    const before = capture(fixture);
    fixture.repos.records.remove(fixture.personId, 'r-latest');
    const report = buildProfileChangeReport({
      before,
      after: capture(fixture),
      undo: null,
      undoUnavailable: 'delete',
    });

    // The profile reverted to the older value, so the sheet says so and offers nothing. There is
    // no height in this fixture, so BMI is null before and after and never appears.
    expect(report?.changes).toEqual([{ kind: 'weight', from: 70, to: 82 }]);
    expect(report?.undo).toBeNull();
    expect(report?.undoUnavailable).toBe('delete');

    // Deleting the remaining record leaves no weight at all — still a change.
    const beforeSecond = capture(fixture);
    fixture.repos.records.remove(fixture.personId, 'r-older');
    const second = buildProfileChangeReport({
      before: beforeSecond,
      after: capture(fixture),
      undo: null,
      undoUnavailable: 'delete',
    });
    expect(second?.changes[0]).toEqual({ kind: 'weight', from: 82, to: null });
    fixture.close();
  });
});

describe('profileChangeStore', () => {
  it('holds one pending change, notifies subscribers and clears on dismiss', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToProfileChange(listener);

    expect(getProfileChange()).toBeNull();
    publishProfileChange({
      changes: [{ kind: 'weight', from: 70, to: 72 }],
      undo: { measurementIds: ['m1'], medicationIds: [] },
      undoUnavailable: null,
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getProfileChange()?.changes).toHaveLength(1);

    dismissProfileChange();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getProfileChange()).toBeNull();

    unsubscribe();
    publishProfileChange(null);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
