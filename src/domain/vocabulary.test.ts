import { HEIGHT_CM_RANGE, inRange, WEIGHT_KG_RANGE } from './limits';
import { isBloodType, MEASUREMENT_UNITS, RECORD_KINDS, SEXES } from './vocabulary';

describe('inRange', () => {
  it('accepts inclusive bounds and rejects everything else', () => {
    expect(inRange(HEIGHT_CM_RANGE.min, HEIGHT_CM_RANGE)).toBe(true);
    expect(inRange(HEIGHT_CM_RANGE.max, HEIGHT_CM_RANGE)).toBe(true);
    expect(inRange(170, HEIGHT_CM_RANGE)).toBe(true);
    expect(inRange(HEIGHT_CM_RANGE.min - 1, HEIGHT_CM_RANGE)).toBe(false);
    expect(inRange(HEIGHT_CM_RANGE.max + 1, HEIGHT_CM_RANGE)).toBe(false);
    expect(inRange(Number.NaN, WEIGHT_KG_RANGE)).toBe(false);
  });
});

describe('vocabulary', () => {
  it('lists the six record kinds from the phase spec', () => {
    expect([...RECORD_KINDS]).toEqual([
      'doctor_visit',
      'self_care',
      'lab_test',
      'procedure',
      'vaccination',
      'other',
    ]);
  });

  it('covers every sex option the onboarding form offers', () => {
    expect([...SEXES]).toEqual(['female', 'male', 'other', 'prefer_not_to_say']);
  });

  it('recognises blood types and nothing else', () => {
    expect(isBloodType('O+')).toBe(true);
    expect(isBloodType('AB-')).toBe(true);
    expect(isBloodType('C+')).toBe(false);
    expect(isBloodType('')).toBe(false);
  });

  it('has a canonical unit for every measurement kind', () => {
    expect(MEASUREMENT_UNITS.bp).toBe('mmHg');
    expect(MEASUREMENT_UNITS.height).toBe('cm');
    expect(MEASUREMENT_UNITS.weight).toBe('kg');
  });
});
