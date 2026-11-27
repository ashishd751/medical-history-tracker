/**
 * @jest-environment node
 *
 * The derived profile against real SQLite (ADR-019): assembly, backdating and undo.
 */
import { createRepositoryFixture, recordInput } from '../testing/repositoryFixture';

const TODAY = '2026-11-27';

function snapshotOf(fixture: ReturnType<typeof createRepositoryFixture>) {
  return fixture.repos.profile.snapshot(fixture.personId, { today: TODAY, bmiPreset: 'asian' });
}

describe('profileRepository.snapshot', () => {
  it('assembles the newest height, weight, derived BMI, blood pressure and medication', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.people.update(fixture.personId, { bloodType: 'O+' });
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
    fixture.repos.medications.create(fixture.personId, {
      name: 'Synthetic Amoxicillin',
      startOn: '2026-03-01',
    });

    const snapshot = snapshotOf(fixture);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.heightCm).toBe(170);
    expect(snapshot?.weightKg).toBe(70);
    expect(snapshot?.bmi).toBe(24.2);
    expect(snapshot?.bmiCategory).toBe('overweight');
    expect(snapshot?.bloodPressure).toEqual({
      systolic: 128,
      diastolic: 82,
      measuredOn: '2026-03-01',
    });
    expect(snapshot?.bloodType).toBe('O+');
    expect(snapshot?.medications.map((medication) => medication.name)).toEqual([
      'Synthetic Amoxicillin',
    ]);
    fixture.close();
  });

  it('returns null for a person that does not exist', () => {
    const fixture = createRepositoryFixture();
    expect(
      fixture.repos.profile.snapshot('missing', { today: TODAY, bmiPreset: 'who' }),
    ).toBeNull();
    fixture.close();
  });

  it('does not let a backdated record overwrite a newer value', () => {
    const fixture = createRepositoryFixture();
    const newer = fixture.repos.records.create(
      fixture.personId,
      recordInput({ id: 'r-new', date: '2026-03-01', vitals: [{ kind: 'weight', v1: 70 }] }),
    );
    if (!newer.ok) throw new Error('setup failed');
    expect(snapshotOf(fixture)?.weightKg).toBe(70);

    const backdated = fixture.repos.records.create(
      fixture.personId,
      recordInput({ id: 'r-old', date: '2025-12-01', vitals: [{ kind: 'weight', v1: 78 }] }),
    );
    if (!backdated.ok) throw new Error('setup failed');

    // Same profile value, so `computeProfileDiff` reports nothing and no sheet appears.
    expect(snapshotOf(fixture)?.weightKg).toBe(70);
    // The value is nevertheless in the history.
    expect(
      fixture.repos.measurements.listByKind(fixture.personId, 'weight').map((row) => row.v1),
    ).toEqual([70, 78]);
    fixture.close();
  });

  it('ignores a blood pressure row that has no diastolic value', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.measurements.create(fixture.personId, {
      kind: 'bp',
      v1: 128,
      measuredOn: '2026-03-01',
    });

    expect(snapshotOf(fixture)?.bloodPressure).toBeNull();
    fixture.close();
  });

  it('leaves out a medication whose end date has passed', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.medications.create(fixture.personId, {
      name: 'Synthetic Ended',
      startOn: '2026-01-01',
      endOn: '2026-11-26',
    });
    fixture.repos.medications.create(fixture.personId, {
      name: 'Synthetic Current',
      startOn: '2026-01-01',
    });

    expect(snapshotOf(fixture)?.medications.map((medication) => medication.name)).toEqual([
      'Synthetic Current',
    ]);
    fixture.close();
  });
});

describe('profileRepository.undo', () => {
  it('takes the record’s rows out of the profile and keeps them on the record', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.measurements.create(fixture.personId, {
      kind: 'weight',
      v1: 70,
      measuredOn: '2026-01-01',
    });
    const before = snapshotOf(fixture);

    const created = fixture.repos.records.create(
      fixture.personId,
      recordInput({
        id: 'r1',
        date: '2026-03-01',
        vitals: [{ kind: 'weight', v1: 74 }],
        medications: [{ name: 'Synthetic Metformin' }],
      }),
    );
    if (!created.ok) throw new Error('setup failed');

    const after = snapshotOf(fixture);
    expect(after?.weightKg).toBe(74);
    expect(after?.medications).toHaveLength(1);

    const detail = fixture.repos.records.getDetail(fixture.personId, 'r1');
    if (!detail) throw new Error('missing detail');
    const plan = {
      measurementIds: detail.measurements.map((row) => row.id),
      medicationIds: detail.medications.map((row) => row.id),
    };

    expect(fixture.repos.profile.undo(fixture.personId, plan)).toEqual({ ok: true, value: true });

    const undone = snapshotOf(fixture);
    expect(undone?.weightKg).toBe(before?.weightKg);
    expect(undone?.medications).toEqual([]);

    // Nothing was deleted: the record still shows its own vitals and medication.
    const kept = fixture.repos.records.getDetail(fixture.personId, 'r1');
    expect(kept?.measurements.map((row) => row.v1)).toEqual([74]);
    expect(kept?.measurements[0]?.profileExcluded).toBe(true);
    expect(kept?.medications).toHaveLength(1);
    fixture.close();
  });

  it('is person-scoped and treats an empty plan as a no-op', () => {
    const fixture = createRepositoryFixture();
    const otherPerson = fixture.addPerson('Synthetic Relative');
    const created = fixture.repos.measurements.create(fixture.personId, {
      kind: 'weight',
      v1: 74,
      measuredOn: '2026-03-01',
    });
    if (!created.ok) throw new Error('setup failed');

    expect(
      fixture.repos.profile.undo(otherPerson, {
        measurementIds: [created.value.id],
        medicationIds: [],
      }),
    ).toEqual({ ok: true, value: true });
    expect(snapshotOf(fixture)?.weightKg).toBe(74);

    expect(
      fixture.repos.profile.undo(fixture.personId, { measurementIds: [], medicationIds: [] }),
    ).toEqual({ ok: true, value: true });
    expect(snapshotOf(fixture)?.weightKg).toBe(74);
    fixture.close();
  });
});
