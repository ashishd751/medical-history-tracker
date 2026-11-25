import { bpCategory, formatReading, isPlausibleReading } from './bloodPressure';

describe('bpCategory', () => {
  it('returns normal below 120/80', () => {
    expect(bpCategory(119, 79)).toBe('normal');
    expect(bpCategory(110, 70)).toBe('normal');
  });

  it('returns elevated for 120–129 systolic with diastolic below 80', () => {
    expect(bpCategory(120, 79)).toBe('elevated');
    expect(bpCategory(129, 79)).toBe('elevated');
  });

  it('returns stage 1 when either number reaches its threshold', () => {
    expect(bpCategory(120, 80)).toBe('stage1');
    expect(bpCategory(130, 70)).toBe('stage1');
    expect(bpCategory(139, 89)).toBe('stage1');
  });

  it('returns stage 2 when either number crosses 140/90', () => {
    expect(bpCategory(140, 70)).toBe('stage2');
    expect(bpCategory(120, 90)).toBe('stage2');
    expect(bpCategory(179, 119)).toBe('stage2');
  });

  it('returns very high at 180/120 or above', () => {
    expect(bpCategory(180, 80)).toBe('very_high');
    expect(bpCategory(120, 120)).toBe('very_high');
    expect(bpCategory(210, 130)).toBe('very_high');
  });

  it('returns null instead of guessing when a number is missing', () => {
    expect(bpCategory(Number.NaN, 80)).toBeNull();
    expect(bpCategory(120, 0)).toBeNull();
    expect(bpCategory(0, 0)).toBeNull();
  });
});

describe('isPlausibleReading', () => {
  it('accepts human readings and rejects typos', () => {
    expect(isPlausibleReading(120, 80)).toBe(true);
    expect(isPlausibleReading(250, 150)).toBe(true);
    expect(isPlausibleReading(40, 80)).toBe(false);
    expect(isPlausibleReading(120, 10)).toBe(false);
    expect(isPlausibleReading(120, Number.NaN)).toBe(false);
  });
});

describe('formatReading', () => {
  it('renders systolic over diastolic', () => {
    expect(formatReading(128, 82)).toBe('128/82');
    expect(formatReading(128.4, 81.6)).toBe('128/82');
  });
});
