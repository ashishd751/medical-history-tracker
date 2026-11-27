/**
 * Profile-change formatting: metric in, the user's units out.
 *
 * The domain compares in metric only; these cases are what keeps the imperial setting honest
 * (checklist item 6).
 */
import { formatProfileChange, formatProfileChanges } from './format';
import { strings } from './strings';

describe('formatProfileChange', () => {
  it('formats body changes in metric when the setting is metric', () => {
    expect(formatProfileChange({ kind: 'weight', from: 70, to: 72 }, 'metric')).toEqual([
      {
        key: 'weight',
        label: strings.profile.changes.weight,
        from: '70 kg',
        to: '72 kg',
        testID: 'profile-change-weight',
      },
    ]);
    expect(formatProfileChange({ kind: 'height', from: 170, to: 172 }, 'metric')[0]).toMatchObject({
      from: '170 cm',
      to: '172 cm',
    });
  });

  it('converts to imperial at display time only', () => {
    expect(formatProfileChange({ kind: 'weight', from: 70, to: 72 }, 'imperial')[0]).toMatchObject({
      from: '154.3 lb',
      to: '158.7 lb',
    });
    expect(
      formatProfileChange({ kind: 'height', from: 170, to: 172 }, 'imperial')[0],
    ).toMatchObject({
      from: '5 ft 7 in',
      to: '5 ft 8 in',
    });
  });

  it('shows "Not recorded" for a value that did not exist', () => {
    expect(formatProfileChange({ kind: 'weight', from: null, to: 70 }, 'metric')[0]).toMatchObject({
      from: strings.common.notRecorded,
      to: '70 kg',
    });
  });

  it('formats BMI and blood pressure without inventing a unit', () => {
    expect(formatProfileChange({ kind: 'bmi', from: 24.2, to: 24.9 }, 'metric')[0]).toMatchObject({
      from: '24.2',
      to: '24.9',
    });
    expect(
      formatProfileChange(
        {
          kind: 'bloodPressure',
          from: { systolic: 128, diastolic: 82 },
          to: { systolic: 134, diastolic: 86 },
        },
        'metric',
      )[0],
    ).toMatchObject({ from: '128/82 mmHg', to: '134/86 mmHg' });
  });

  it('uses the shared blood-type labels, including the empty one', () => {
    expect(
      formatProfileChange({ kind: 'bloodType', from: 'O+', to: null }, 'metric')[0],
    ).toMatchObject({ from: 'O+', to: strings.common.notRecorded });
  });

  it('gives a medication change one row per name, with "None" on the empty side', () => {
    const rows = formatProfileChange(
      { kind: 'medications', added: ['Synthetic Metformin'], removed: ['Synthetic Cetirizine'] },
      'metric',
    );

    expect(rows).toEqual([
      {
        key: 'added-Synthetic Metformin',
        label: strings.profile.changes.medications,
        from: strings.common.none,
        to: 'Synthetic Metformin',
        testID: 'profile-change-medication-added',
      },
      {
        key: 'removed-Synthetic Cetirizine',
        label: strings.profile.changes.medications,
        from: 'Synthetic Cetirizine',
        to: strings.common.none,
        testID: 'profile-change-medication-removed',
      },
    ]);
  });
});

describe('formatProfileChanges', () => {
  it('keeps the domain order and flattens medication rows', () => {
    const rows = formatProfileChanges(
      [
        { kind: 'weight', from: 70, to: 72 },
        { kind: 'bmi', from: 24.2, to: 24.9 },
        { kind: 'medications', added: ['Synthetic Metformin'], removed: [] },
      ],
      'metric',
    );

    expect(rows.map((row) => row.key)).toEqual(['weight', 'bmi', 'added-Synthetic Metformin']);
  });
});
