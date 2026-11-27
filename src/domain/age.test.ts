import { ageInYears, MAX_AGE_YEARS } from './age';

describe('ageInYears', () => {
  it('counts whole years after the birthday', () => {
    expect(ageInYears('1990-04-17', '2026-04-17')).toBe(36);
    expect(ageInYears('1990-04-17', '2026-04-18')).toBe(36);
  });

  it('does not count a birthday that has not arrived yet', () => {
    expect(ageInYears('1990-04-17', '2026-04-16')).toBe(35);
    expect(ageInYears('1990-12-31', '2026-01-01')).toBe(35);
  });

  it('handles a February birthday in a leap and a non-leap year', () => {
    expect(ageInYears('2000-02-29', '2026-02-28')).toBe(25);
    expect(ageInYears('2000-02-29', '2026-03-01')).toBe(26);
  });

  it('is zero on the day of birth', () => {
    expect(ageInYears('2026-11-27', '2026-11-27')).toBe(0);
  });

  it('returns null for an unreadable or impossible date', () => {
    expect(ageInYears('17/04/1990', '2026-11-27')).toBeNull();
    expect(ageInYears('1990-13-01', '2026-11-27')).toBeNull();
    expect(ageInYears('1990-04-17', '')).toBeNull();
    expect(ageInYears('', '2026-11-27')).toBeNull();
  });

  it('rejects a birth date in the future and an implausible age', () => {
    expect(ageInYears('2030-01-01', '2026-11-27')).toBeNull();
    expect(ageInYears('1800-01-01', '2026-11-27')).toBeNull();
    expect(MAX_AGE_YEARS).toBe(130);
  });

  it('does not shift across a timezone boundary (no Date is built)', () => {
    // If this were computed through UTC, a negative-offset device would report 35 on 17 April.
    expect(ageInYears('1990-04-17', '2026-04-17')).toBe(36);
  });
});
