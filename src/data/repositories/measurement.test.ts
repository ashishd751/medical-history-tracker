/**
 * @jest-environment node
 */
import { createRepositoryFixture, recordInput } from '../testing/repositoryFixture';

describe('measurementRepository', () => {
  it('returns the latest value by date, not by insertion order', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.measurements.create(fixture.personId, {
      kind: 'weight',
      v1: 70,
      measuredOn: '2026-01-01',
    });
    // Inserted later, but measured earlier: it must not win.
    fixture.repos.measurements.create(fixture.personId, {
      kind: 'weight',
      v1: 74,
      measuredOn: '2025-12-01',
    });

    expect(fixture.repos.measurements.latest(fixture.personId, 'weight')?.v1).toBe(70);
    expect(fixture.repos.measurements.latest(fixture.personId, 'height')).toBeNull();
    fixture.close();
  });

  it('builds the Home snapshot from the latest height, weight and blood pressure', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.measurements.create(fixture.personId, {
      kind: 'height',
      v1: 170,
      measuredOn: '2026-01-01',
    });
    fixture.repos.measurements.create(fixture.personId, {
      kind: 'weight',
      v1: 70,
      measuredOn: '2026-02-01',
    });
    fixture.repos.measurements.create(fixture.personId, {
      kind: 'bp',
      v1: 128,
      v2: 82,
      measuredOn: '2026-03-01',
    });

    const snapshot = fixture.repos.measurements.latestVitals(fixture.personId);
    expect(snapshot.height?.v1).toBe(170);
    expect(snapshot.weight?.v1).toBe(70);
    expect(snapshot.bloodPressure?.v1).toBe(128);
    expect(snapshot.bloodPressure?.v2).toBe(82);
    fixture.close();
  });

  it('lists history newest first and is person-scoped', () => {
    const fixture = createRepositoryFixture();
    const otherPerson = fixture.addPerson('Synthetic Relative');
    const history: readonly (readonly [number, string])[] = [
      [70, '2026-01-01'],
      [71, '2026-02-01'],
      [72, '2026-03-01'],
    ];
    for (const [v1, measuredOn] of history) {
      fixture.repos.measurements.create(fixture.personId, { kind: 'weight', v1, measuredOn });
    }
    fixture.repos.measurements.create(otherPerson, {
      kind: 'weight',
      v1: 99,
      measuredOn: '2026-03-01',
    });

    expect(
      fixture.repos.measurements.listByKind(fixture.personId, 'weight').map((row) => row.v1),
    ).toEqual([72, 71, 70]);
    expect(
      fixture.repos.measurements.listByKind(fixture.personId, 'weight', 1).map((row) => row.v1),
    ).toEqual([72]);
    expect(fixture.repos.measurements.latest(otherPerson, 'weight')?.v1).toBe(99);
    fixture.close();
  });

  it('rejects a non-numeric value and deletes by id', () => {
    const fixture = createRepositoryFixture();
    expect(
      fixture.repos.measurements.create(fixture.personId, {
        kind: 'weight',
        v1: Number.NaN,
        measuredOn: '2026-01-01',
      }).ok,
    ).toBe(false);

    const created = fixture.repos.measurements.create(fixture.personId, {
      kind: 'pulse',
      v1: 72,
      measuredOn: '2026-01-01',
    });
    if (!created.ok) throw new Error('setup failed');

    expect(fixture.repos.measurements.remove(fixture.personId, created.value.id).ok).toBe(true);
    expect(fixture.repos.measurements.latest(fixture.personId, 'pulse')).toBeNull();
    fixture.close();
  });

  it('keeps an excluded row out of the profile but in the history (ADR-039)', () => {
    const fixture = createRepositoryFixture();
    const older = fixture.repos.measurements.create(fixture.personId, {
      kind: 'weight',
      v1: 70,
      measuredOn: '2026-01-01',
    });
    const newer = fixture.repos.measurements.create(fixture.personId, {
      kind: 'weight',
      v1: 74,
      measuredOn: '2026-02-01',
    });
    if (!older.ok || !newer.ok) throw new Error('setup failed');

    expect(fixture.repos.measurements.latest(fixture.personId, 'weight')?.v1).toBe(74);

    const excluded = fixture.repos.measurements.setProfileExcluded(
      fixture.personId,
      [newer.value.id],
      true,
    );
    expect(excluded).toEqual({ ok: true, value: 1 });

    // The profile falls back to the previous value; the row itself is still in the history.
    expect(fixture.repos.measurements.latest(fixture.personId, 'weight')?.v1).toBe(70);
    const history = fixture.repos.measurements.listByKind(fixture.personId, 'weight');
    expect(history.map((row) => row.v1)).toEqual([74, 70]);
    expect(history[0]?.profileExcluded).toBe(true);
    fixture.close();
  });

  it('lists the rows a record wrote and ignores another person’s rows when flagging', () => {
    const fixture = createRepositoryFixture();
    const otherPerson = fixture.addPerson('Synthetic Relative');
    const created = fixture.repos.records.create(
      fixture.personId,
      recordInput({
        id: 'r1',
        vitals: [
          { kind: 'height', v1: 171 },
          { kind: 'weight', v1: 71 },
        ],
      }),
    );
    if (!created.ok) throw new Error(`record failed: ${created.error.detail}`);

    const rows = fixture.repos.measurements.listByRecord(fixture.personId, 'r1');
    expect(rows.map((row) => row.kind).sort()).toEqual(['height', 'weight']);

    // A flag aimed at another person's data must not touch anything.
    const flagged = fixture.repos.measurements.setProfileExcluded(
      otherPerson,
      rows.map((row) => row.id),
      true,
    );
    expect(flagged).toEqual({ ok: true, value: 0 });
    expect(fixture.repos.measurements.latest(fixture.personId, 'weight')?.v1).toBe(71);

    // An empty list is a no-op rather than an `IN ()` syntax error.
    expect(fixture.repos.measurements.setProfileExcluded(fixture.personId, [], true)).toEqual({
      ok: true,
      value: 0,
    });
    fixture.close();
  });
});
