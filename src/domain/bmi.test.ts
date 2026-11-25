import { bmiCategory, computeBmi, roundBmi, summarizeBmi } from './bmi';

describe('computeBmi', () => {
  it('computes kg/m² rounded to one decimal', () => {
    expect(computeBmi(170, 70)).toBe(24.2);
    expect(computeBmi(180, 81)).toBe(25);
    expect(computeBmi(152, 45)).toBe(19.5);
  });

  it('returns null for unusable input instead of NaN', () => {
    expect(computeBmi(0, 70)).toBeNull();
    expect(computeBmi(170, 0)).toBeNull();
    expect(computeBmi(-170, 70)).toBeNull();
    expect(computeBmi(Number.NaN, 70)).toBeNull();
    expect(computeBmi(170, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('rounds half values away from zero at one decimal', () => {
    expect(roundBmi(24.25)).toBe(24.3);
    expect(roundBmi(24.24)).toBe(24.2);
  });
});

describe('bmiCategory', () => {
  it('uses the Asian preset by default (ADR-010)', () => {
    expect(bmiCategory(18.4)).toBe('underweight');
    expect(bmiCategory(18.5)).toBe('normal');
    expect(bmiCategory(22.9)).toBe('normal');
    expect(bmiCategory(23)).toBe('overweight');
    expect(bmiCategory(24.9)).toBe('overweight');
    expect(bmiCategory(25)).toBe('obese');
  });

  it('uses WHO bands when asked', () => {
    expect(bmiCategory(22.9, 'who')).toBe('normal');
    expect(bmiCategory(24.9, 'who')).toBe('normal');
    expect(bmiCategory(25, 'who')).toBe('overweight');
    expect(bmiCategory(29.9, 'who')).toBe('overweight');
    expect(bmiCategory(30, 'who')).toBe('obese');
    expect(bmiCategory(18.4, 'who')).toBe('underweight');
  });

  it('classifies the value the user sees, not the unrounded one', () => {
    // 66.3544 kg at 170 cm is 22.958…, which displays as 23.0 and must then read overweight.
    const bmi = computeBmi(170, 66.3544);
    expect(bmi).toBe(23);
    expect(bmiCategory(bmi ?? 0)).toBe('overweight');
  });
});

describe('summarizeBmi', () => {
  it('returns the value, its category and the preset used', () => {
    expect(summarizeBmi(170, 70)).toEqual({ bmi: 24.2, category: 'overweight', preset: 'asian' });
    expect(summarizeBmi(170, 70, 'who')).toEqual({ bmi: 24.2, category: 'normal', preset: 'who' });
  });

  it('returns null when height or weight is missing', () => {
    expect(summarizeBmi(0, 70)).toBeNull();
  });
});
