import { buildProfileSnapshot } from '@/domain';
import { strings } from '@/ui';

import {
  buildExportFacts,
  buildExportRows,
  exportCell,
  type ExportRecordSource,
  formatExportAttachments,
  formatExportMedications,
  formatExportRange,
  formatExportReading,
  formatExportReadings,
  formatExportVitals,
} from './exportFormat';

/** A synthetic record; invented values only. */
function record(overrides: Partial<ExportRecordSource> = {}): ExportRecordSource {
  return {
    id: 'record-1',
    date: '2026-11-02',
    kind: 'doctor_visit',
    title: 'Synthetic check-up',
    symptoms: ['headache', 'mild fever'],
    condition: 'Synthetic migraine',
    facility: 'Synthetic Clinic',
    comments: 'Synthetic comment',
    followUpOn: '2026-12-02',
    doctorName: 'Dr Test',
    medications: [],
    readings: [],
    measurements: [],
    attachmentRoles: [],
    ...overrides,
  };
}

const metric = { unitSystem: 'metric' } as const;
const imperial = { unitSystem: 'imperial' } as const;

describe('formatExportReading', () => {
  it('writes name, value, unit and range', () => {
    expect(
      formatExportReading({
        name: 'Hb',
        value: '13.5',
        unit: 'g/dL',
        refLow: 13,
        refHigh: 17,
        flag: 'normal',
      }),
    ).toBe('Hb 13.5 g/dL (13–17)');
  });

  it('writes High and Low as words, never colour alone', () => {
    expect(
      formatExportReading({
        name: 'LDL',
        value: '142',
        unit: 'mg/dL',
        refLow: 70,
        refHigh: 100,
        flag: 'high',
      }),
    ).toBe('LDL 142 mg/dL (70–100) — High');
    expect(
      formatExportReading({
        name: 'HDL',
        value: '28',
        unit: 'mg/dL',
        refLow: 40,
        refHigh: null,
        flag: 'low',
      }),
    ).toBe('HDL 28 mg/dL (40–) — Low');
  });

  it('leaves Normal and Not flagged out of the cell', () => {
    expect(
      formatExportReading({
        name: 'Hb',
        value: '14',
        unit: '',
        refLow: null,
        refHigh: null,
        flag: 'normal',
      }),
    ).toBe('Hb 14');
    expect(
      formatExportReading({
        name: 'Hb',
        value: '14',
        unit: '',
        refLow: null,
        refHigh: null,
        flag: 'unknown',
      }),
    ).toBe('Hb 14');
  });

  it('handles a range with only an upper bound', () => {
    expect(
      formatExportReading({
        name: 'CRP',
        value: '2',
        unit: 'mg/L',
        refLow: null,
        refHigh: 5,
        flag: 'normal',
      }),
    ).toBe('CRP 2 mg/L (–5)');
  });
});

describe('formatExportReadings', () => {
  it('joins several readings with a bar', () => {
    expect(
      formatExportReadings([
        { name: 'Hb', value: '13.5', unit: 'g/dL', refLow: 13, refHigh: 17, flag: 'normal' },
        { name: 'LDL', value: '142', unit: 'mg/dL', refLow: 70, refHigh: 100, flag: 'high' },
      ]),
    ).toBe('Hb 13.5 g/dL (13–17) | LDL 142 mg/dL (70–100) — High');
  });

  it('is empty for no readings', () => {
    expect(formatExportReadings([])).toBe('');
  });
});

describe('formatExportMedications', () => {
  it('writes name, dose and frequency', () => {
    expect(
      formatExportMedications([{ name: 'Metformin', dose: '500 mg', frequency: 'twice a day' }]),
    ).toBe('Metformin 500 mg, twice a day');
  });

  it('omits a blank dose or frequency instead of leaving a comma', () => {
    expect(formatExportMedications([{ name: 'Paracetamol', dose: '', frequency: '' }])).toBe(
      'Paracetamol',
    );
    expect(
      formatExportMedications([{ name: 'Paracetamol', dose: '', frequency: 'as needed' }]),
    ).toBe('Paracetamol, as needed');
  });

  it('joins several medications with a bar', () => {
    expect(
      formatExportMedications([
        { name: 'A', dose: '1', frequency: 'daily' },
        { name: 'B', dose: '2', frequency: '' },
      ]),
    ).toBe('A 1, daily | B 2');
  });

  it('is empty for no medications', () => {
    expect(formatExportMedications([])).toBe('');
  });
});

describe('compact cells', () => {
  it('labels vitals shortly and converts to the user system', () => {
    expect(
      formatExportVitals(
        [
          { kind: 'bp', v1: 120, v2: 80 },
          { kind: 'pulse', v1: 72, v2: null },
          { kind: 'temperature', v1: 36.8, v2: null },
        ],
        'metric',
      ),
    ).toBe('BP 120/80 mmHg | Pulse 72 bpm | Temp 36.8 °C');
  });

  it('uses pounds and Fahrenheit under the imperial setting', () => {
    const text = formatExportVitals(
      [
        { kind: 'weight', v1: 70, v2: null },
        { kind: 'temperature', v1: 37, v2: null },
      ],
      'imperial',
    );
    expect(text).toBe('Weight 154.3 lb | Temp 98.6 °F');
  });

  it('does not invent a diastolic value for a one-number BP row', () => {
    expect(formatExportVitals([{ kind: 'bp', v1: 120, v2: null }], 'metric')).toBe('BP 120 mmHg');
  });

  describe('formatExportAttachments', () => {
    it('is empty when a record has no files', () => {
      expect(formatExportAttachments([])).toBe('');
    });

    it('counts the files and groups them by role', () => {
      expect(formatExportAttachments(['lab_report'])).toBe('1 file: 1 lab report');
      expect(formatExportAttachments(['lab_report', 'lab_report', 'prescription'])).toBe(
        '3 files: 1 prescription, 2 lab reports',
      );
      expect(formatExportAttachments(['other', 'other'])).toBe('2 files: 2 other files');
    });
  });

  describe('exportCell', () => {
    it('renders dates as DD/MM/YYYY, never ISO', () => {
      expect(exportCell('date', record(), metric)).toBe('02/11/2026');
      expect(exportCell('followUp', record(), metric)).toBe('02/12/2026');
    });

    it('renders the record title and the type label', () => {
      expect(exportCell('title', record(), metric)).toBe('Synthetic check-up');
      expect(exportCell('type', record(), metric)).toBe('Doctor visit');
    });

    it('joins symptoms and keeps free text as typed', () => {
      expect(exportCell('symptoms', record(), metric)).toBe('headache, mild fever');
      expect(exportCell('comments', record(), metric)).toBe('Synthetic comment');
      expect(exportCell('condition', record(), metric)).toBe('Synthetic migraine');
      expect(exportCell('facility', record(), metric)).toBe('Synthetic Clinic');
    });

    it('returns an empty cell for a record with no doctor, follow-up or attachments', () => {
      const bare = record({ doctorName: null, followUpOn: null });
      expect(exportCell('doctor', bare, metric)).toBe('');
      expect(exportCell('followUp', bare, metric)).toBe('');
      expect(exportCell('attachments', bare, metric)).toBe('');
    });

    it('renders the optional columns from the record children', () => {
      const full = record({
        readings: [
          { name: 'Hb', value: '13.5', unit: 'g/dL', refLow: 13, refHigh: 17, flag: 'normal' },
        ],
        medications: [{ name: 'Metformin', dose: '500 mg', frequency: 'daily' }],
        measurements: [{ kind: 'weight', v1: 70, v2: null }],
        attachmentRoles: ['lab_report'],
      });
      expect(exportCell('readings', full, metric)).toBe('Hb 13.5 g/dL (13–17)');
      expect(exportCell('medications', full, metric)).toBe('Metformin 500 mg, daily');
      expect(exportCell('vitals', full, metric)).toBe('Weight 70 kg');
      expect(exportCell('vitals', full, imperial)).toBe('Weight 154.3 lb');
      expect(exportCell('attachments', full, metric)).toBe('1 file: 1 lab report');
    });

    it('handles Unicode and hostile text without changing it', () => {
      const text = 'सिरदर्द 🩺 <b>bold</b> & "quoted"';
      expect(exportCell('symptoms', record({ symptoms: [text] }), metric)).toBe(text);
    });
  });

  describe('buildExportRows', () => {
    it('produces one row per record, one cell per column, in column order', () => {
      const rows = buildExportRows(
        [record(), record({ id: 'record-2', date: '2026-01-05', symptoms: [] })],
        ['date', 'symptoms', 'doctor'],
        metric,
      );
      expect(rows).toEqual([
        { id: 'record-1', cells: ['02/11/2026', 'headache, mild fever', 'Dr Test'] },
        { id: 'record-2', cells: ['05/01/2026', '', 'Dr Test'] },
      ]);
    });

    it('produces no rows for no records', () => {
      expect(buildExportRows([], ['date'], metric)).toEqual([]);
    });
  });

  it('is empty for no measurements', () => {
    expect(formatExportVitals([], 'metric')).toBe('');
  });
});

describe('buildExportFacts', () => {
  const snapshot = buildProfileSnapshot({
    heightCm: 170,
    weightKg: 70,
    bloodPressure: { systolic: 120, diastolic: 80, measuredOn: '2026-11-01' },
    bloodType: 'O+',
    medications: [{ id: 'm1', name: 'Syntheticstatin' }],
    bmiPreset: 'asian',
  });

  it('mirrors the profile in metric units', () => {
    expect(
      buildExportFacts({ snapshot, today: '2026-11-27', dob: '1990-04-17', unitSystem: 'metric' }),
    ).toEqual([
      { label: strings.export.factAge, value: '36 years' },
      { label: strings.export.factBloodType, value: 'O+' },
      { label: strings.export.factHeight, value: '170 cm' },
      { label: strings.export.factWeight, value: '70 kg' },
      { label: strings.export.factBmi, value: '24.2 (Overweight)' },
      { label: strings.export.factLastBp, value: '120/80 mmHg on 01/11/2026' },
      { label: strings.export.factMedication, value: 'Syntheticstatin' },
    ]);
  });

  it('converts to imperial without touching the stored values', () => {
    const facts = buildExportFacts({
      snapshot,
      today: '2026-11-27',
      dob: '1990-04-17',
      unitSystem: 'imperial',
    });
    // 170 cm is 66.9 in, which rounds to 5 ft 7 in.
    expect(facts.find((fact) => fact.label === strings.export.factHeight)?.value).toBe('5 ft 7 in');
    expect(facts.find((fact) => fact.label === strings.export.factWeight)?.value).toBe('154.3 lb');
    // The snapshot itself is metric and unchanged.
    expect(snapshot.weightKg).toBe(70);
  });

  it('writes Not recorded / None instead of dropping a missing value', () => {
    const empty = buildProfileSnapshot({
      heightCm: null,
      weightKg: null,
      bloodPressure: null,
      bloodType: null,
      medications: [],
      bmiPreset: 'who',
    });
    const facts = buildExportFacts({
      snapshot: empty,
      today: '2026-11-27',
      dob: '1990-04-17',
      unitSystem: 'metric',
    });
    expect(facts).toHaveLength(7);
    expect(facts[0]?.value).toBe('36 years');
    expect(facts[1]?.value).toBe(strings.common.notRecorded);
    expect(facts[2]?.value).toBe(strings.common.notRecorded);
    expect(facts[4]?.value).toBe(strings.common.notRecorded);
    expect(facts[5]?.value).toBe(strings.common.notRecorded);
    expect(facts[6]?.value).toBe(strings.common.none);
  });

  it('does not invent an age from an unreadable date of birth', () => {
    const facts = buildExportFacts({
      snapshot,
      today: '2026-11-27',
      dob: 'not a date',
      unitSystem: 'metric',
    });
    expect(facts[0]?.value).toBe(strings.common.notRecorded);
  });
});

describe('formatExportRange', () => {
  it('writes both bounds as DD/MM/YYYY', () => {
    expect(formatExportRange('2025-01-01', '2026-11-27')).toBe('01/01/2025 – 27/11/2026');
  });

  it('describes a one-sided or missing range', () => {
    expect(formatExportRange('2025-01-01', undefined)).toBe('from 01/01/2025');
    expect(formatExportRange(undefined, '2026-11-27')).toBe('until 27/11/2026');
    expect(formatExportRange(undefined, undefined)).toBe(strings.export.allTimeRange);
  });
});
