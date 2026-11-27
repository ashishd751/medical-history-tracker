/**
 * The derived profile, its diff and its two rules (Phase 3).
 *
 * Every case is synthetic. `today` is always passed in, so nothing here depends on the clock.
 */
import {
  buildProfileSnapshot,
  computeProfileDiff,
  emptyProfileSnapshot,
  isCurrentMedication,
  PROFILE_TOLERANCE,
  type ProfileSnapshot,
  requiresBloodTypeConfirmation,
} from './profile';

function snapshot(overrides: Partial<ProfileSnapshot> = {}): ProfileSnapshot {
  return { ...emptyProfileSnapshot(), ...overrides };
}

const TODAY = '2026-11-27';

describe('buildProfileSnapshot', () => {
  it('derives BMI and its category from the latest height and weight', () => {
    const result = buildProfileSnapshot({
      heightCm: 170,
      weightKg: 70,
      bloodPressure: null,
      bloodType: 'O+',
      medications: [],
      bmiPreset: 'asian',
    });

    expect(result.bmi).toBe(24.2);
    // 24.2 is overweight on the Asian preset and normal on WHO (ADR-010).
    expect(result.bmiCategory).toBe('overweight');
    expect(
      buildProfileSnapshot({
        heightCm: 170,
        weightKg: 70,
        bloodPressure: null,
        bloodType: 'O+',
        medications: [],
        bmiPreset: 'who',
      }).bmiCategory,
    ).toBe('normal');
  });

  it('leaves BMI null when either half is missing', () => {
    const withoutWeight = buildProfileSnapshot({
      heightCm: 170,
      weightKg: null,
      bloodPressure: null,
      bloodType: null,
      medications: [],
      bmiPreset: 'asian',
    });
    const withoutHeight = buildProfileSnapshot({
      heightCm: null,
      weightKg: 70,
      bloodPressure: null,
      bloodType: null,
      medications: [],
      bmiPreset: 'asian',
    });

    expect(withoutWeight.bmi).toBeNull();
    expect(withoutWeight.bmiCategory).toBeNull();
    expect(withoutHeight.bmi).toBeNull();
  });
});

describe('computeProfileDiff', () => {
  it('reports nothing when the snapshot did not move', () => {
    const before = snapshot({ heightCm: 170, weightKg: 70, bmi: 24.2, bmiCategory: 'normal' });
    expect(computeProfileDiff(before, { ...before })).toEqual([]);
  });

  it('reports nothing when a backdated record leaves the latest value alone', () => {
    // The repository returns the newest measured_on per kind, so a backdated row cannot reach
    // this function as a change: both snapshots carry the same value (section 4.1).
    const before = snapshot({ weightKg: 70, heightCm: 170, bmi: 24.2 });
    const after = snapshot({ weightKg: 70, heightCm: 170, bmi: 24.2 });

    expect(computeProfileDiff(before, after)).toEqual([]);
  });

  it('ignores a weight difference inside the tolerance and reports one past it', () => {
    const before = snapshot({ weightKg: 70 });
    const inside = snapshot({ weightKg: 70 + 0.02 });
    const outside = snapshot({ weightKg: 70 + 0.06 });

    expect(computeProfileDiff(before, inside)).toEqual([]);
    expect(computeProfileDiff(before, outside)).toEqual([{ kind: 'weight', from: 70, to: 70.06 }]);
    expect(PROFILE_TOLERANCE.weightKg).toBe(0.05);
  });

  it('uses a wider tolerance for height, which is entered in inches when imperial', () => {
    const before = snapshot({ heightCm: 170 });
    expect(computeProfileDiff(before, snapshot({ heightCm: 170.4 }))).toEqual([]);
    expect(computeProfileDiff(before, snapshot({ heightCm: 170.6 }))).toEqual([
      { kind: 'height', from: 170, to: 170.6 },
    ]);
  });

  it('compares BMI at the displayed precision, never at full float precision', () => {
    const before = snapshot({ heightCm: 170, weightKg: 70, bmi: 24.22145 });
    const jitter = snapshot({ heightCm: 170, weightKg: 70.02, bmi: 24.22837 });

    // 24.2 in both cases, and the weight difference is inside its tolerance.
    expect(computeProfileDiff(before, jitter)).toEqual([]);
  });

  it('lists the weight before the BMI it moved', () => {
    const before = snapshot({ heightCm: 170, weightKg: 70, bmi: 24.2 });
    const after = snapshot({ heightCm: 170, weightKg: 72, bmi: 24.9 });

    expect(computeProfileDiff(before, after)).toEqual([
      { kind: 'weight', from: 70, to: 72 },
      { kind: 'bmi', from: 24.2, to: 24.9 },
    ]);
  });

  it('reports the first value of a previously empty field', () => {
    expect(computeProfileDiff(snapshot(), snapshot({ weightKg: 70, bmi: 24.2 }))).toEqual([
      { kind: 'weight', from: null, to: 70 },
      { kind: 'bmi', from: null, to: 24.2 },
    ]);
  });

  it('ignores a blood pressure that repeats the same numbers on a later date', () => {
    const before = snapshot({
      bloodPressure: { systolic: 128, diastolic: 82, measuredOn: '2026-01-01' },
    });
    const after = snapshot({
      bloodPressure: { systolic: 128, diastolic: 82, measuredOn: '2026-03-01' },
    });

    expect(computeProfileDiff(before, after)).toEqual([]);
  });

  it('reports a changed blood pressure and keeps the date out of the comparison', () => {
    const before = snapshot({
      bloodPressure: { systolic: 128, diastolic: 82, measuredOn: '2026-01-01' },
    });
    const after = snapshot({
      bloodPressure: { systolic: 134, diastolic: 86, measuredOn: '2026-03-01' },
    });

    expect(computeProfileDiff(before, after)).toEqual([
      {
        kind: 'bloodPressure',
        from: { systolic: 128, diastolic: 82 },
        to: { systolic: 134, diastolic: 86 },
      },
    ]);
  });

  it('reports a blood type that goes from empty to set, and one that changes', () => {
    expect(computeProfileDiff(snapshot(), snapshot({ bloodType: 'O+' }))).toEqual([
      { kind: 'bloodType', from: null, to: 'O+' },
    ]);
    expect(
      computeProfileDiff(snapshot({ bloodType: 'O+' }), snapshot({ bloodType: 'A-' })),
    ).toEqual([{ kind: 'bloodType', from: 'O+', to: 'A-' }]);
  });

  it('reports added and removed medication by name', () => {
    const before = snapshot({
      medications: [
        { id: 'm1', name: 'Synthetic Amoxicillin' },
        { id: 'm2', name: 'Synthetic Cetirizine' },
      ],
    });
    const after = snapshot({
      medications: [
        { id: 'm1', name: 'Synthetic Amoxicillin' },
        { id: 'm3', name: 'Synthetic Metformin' },
      ],
    });

    expect(computeProfileDiff(before, after)).toEqual([
      {
        kind: 'medications',
        added: ['Synthetic Metformin'],
        removed: ['Synthetic Cetirizine'],
      },
    ]);
  });

  it('reports nothing when the same medication keeps its name under a new row id', () => {
    // A record edit deletes and re-inserts its medications, so the id changes while the name
    // does not. The profile shows names, and it must not claim a change.
    const before = snapshot({ medications: [{ id: 'm1', name: 'Synthetic Amoxicillin' }] });
    const after = snapshot({ medications: [{ id: 'm9', name: 'Synthetic Amoxicillin' }] });

    expect(computeProfileDiff(before, after)).toEqual([]);
  });
});

describe('isCurrentMedication', () => {
  it.each([
    ['ongoing without an end date', { status: 'ongoing', endOn: null } as const, true],
    ['ongoing, ending today', { status: 'ongoing', endOn: TODAY } as const, true],
    ['ongoing, ending tomorrow', { status: 'ongoing', endOn: '2026-11-28' } as const, true],
    ['ongoing, ended yesterday', { status: 'ongoing', endOn: '2026-11-26' } as const, false],
    ['completed without an end date', { status: 'completed', endOn: null } as const, false],
    ['stopped with a future end date', { status: 'stopped', endOn: '2027-01-01' } as const, false],
  ])('%s → %s', (_label, medication, expected) => {
    expect(isCurrentMedication(medication, TODAY)).toBe(expected);
  });
});

describe('requiresBloodTypeConfirmation', () => {
  it.each([
    ['first time set', null, 'O+', false],
    ['unchanged', 'O+', 'O+', false],
    ['changed to another group', 'O+', 'A-', true],
    ['cleared', 'O+', null, true],
    ['still unset', null, null, false],
  ] as const)('%s → %s', (_label, previous, next, expected) => {
    expect(requiresBloodTypeConfirmation(previous, next)).toBe(expected);
  });
});
