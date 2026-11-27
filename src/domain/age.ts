/**
 * Age from two `YYYY-MM-DD` dates, in whole years, without ever building a `Date`.
 *
 * A date-only value must not be round-tripped through UTC (ADR-017); comparing the three fields
 * as strings/numbers keeps the birthday correct in every timezone. Used by the export header and
 * reusable by the Phase 6 review screen.
 */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Oldest plausible age; guards a mistyped year of birth from producing "age 320". */
export const MAX_AGE_YEARS = 130;

export function ageInYears(dob: string, today: string): number | null {
  const birth = ISO_DATE.exec(dob);
  const now = ISO_DATE.exec(today);
  if (!birth || !now) return null;

  const birthYear = Number(birth[1]);
  const birthMonth = Number(birth[2]);
  const birthDay = Number(birth[3]);
  const nowYear = Number(now[1]);
  const nowMonth = Number(now[2]);
  const nowDay = Number(now[3]);

  if (birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) return null;
  if (nowMonth < 1 || nowMonth > 12 || nowDay < 1 || nowDay > 31) return null;

  let age = nowYear - birthYear;
  // The birthday has not happened yet this year.
  if (nowMonth < birthMonth || (nowMonth === birthMonth && nowDay < birthDay)) age -= 1;

  return age >= 0 && age <= MAX_AGE_YEARS ? age : null;
}
