/**
 * The add-measurement form's conversions and ranges.
 *
 * Synthetic values only; the imperial cases are what checklist item 6 exercises on a device.
 */
import { toMeasurementSubmission, toMetric } from './measurementInput';

const TODAY = '2026-11-27';

function draft(overrides: Partial<Parameters<typeof toMeasurementSubmission>[0]> = {}) {
  return { kind: 'weight' as const, value1: '70', value2: '', measuredOn: TODAY, ...overrides };
}

describe('toMetric', () => {
  it('leaves metric values alone', () => {
    expect(toMetric('height', 170, 'metric')).toBe(170);
    expect(toMetric('weight', 70, 'metric')).toBe(70);
  });

  it('converts the imperial inputs for height, weight and temperature only', () => {
    expect(toMetric('height', 67, 'imperial')).toBe(170.2);
    expect(toMetric('weight', 154, 'imperial')).toBe(69.85);
    expect(toMetric('temperature', 98.6, 'imperial')).toBe(37);
    // Pulse, SpO2, glucose and blood pressure are not imperial quantities.
    expect(toMetric('pulse', 72, 'imperial')).toBe(72);
    expect(toMetric('spo2', 98, 'imperial')).toBe(98);
  });
});

describe('toMeasurementSubmission', () => {
  it('accepts a plausible single-value measurement', () => {
    expect(toMeasurementSubmission(draft(), 'metric')).toEqual({
      ok: true,
      submission: { kind: 'weight', v1: 70, v2: null, measuredOn: TODAY },
    });
  });

  it('accepts an imperial weight by converting before the range check', () => {
    expect(toMeasurementSubmission(draft({ value1: '154' }), 'imperial')).toEqual({
      ok: true,
      submission: { kind: 'weight', v1: 69.85, v2: null, measuredOn: TODAY },
    });
  });

  it('requires both halves of a blood pressure', () => {
    expect(
      toMeasurementSubmission(draft({ kind: 'bp', value1: '128', value2: '' }), 'metric'),
    ).toEqual({ ok: false, error: 'value' });
    expect(
      toMeasurementSubmission(draft({ kind: 'bp', value1: '128', value2: '82' }), 'metric'),
    ).toEqual({
      ok: true,
      submission: { kind: 'bp', v1: 128, v2: 82, measuredOn: TODAY },
    });
  });

  it.each([
    ['an empty weight', draft({ value1: '  ' })],
    ['text instead of a number', draft({ value1: 'seventy' })],
    ['a weight below the range', draft({ value1: '0.5' })],
    ['a weight above the range', draft({ value1: '401' })],
    ['a SpO2 above 100', draft({ kind: 'spo2', value1: '101' })],
    ['a systolic above the range', draft({ kind: 'bp', value1: '301', value2: '82' })],
    ['a diastolic below the range', draft({ kind: 'bp', value1: '128', value2: '10' })],
    ['an impossible date', draft({ measuredOn: '2026-02-30' })],
  ])('refuses %s', (_label, input) => {
    const result = toMeasurementSubmission(input, 'metric');
    expect(result.ok).toBe(false);
  });

  it('reports an unreadable date as a date problem, not a value problem', () => {
    expect(toMeasurementSubmission(draft({ measuredOn: '' }), 'metric')).toEqual({
      ok: false,
      error: 'date',
    });
  });
});
