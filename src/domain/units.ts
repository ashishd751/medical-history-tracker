/**
 * Unit conversion.
 *
 * Measurements are stored in metric; conversion happens only when a value is displayed or a
 * value is entered in imperial units (section 9). Every helper is pure and covers both
 * directions so a round trip can be tested.
 */

const KG_PER_LB = 0.45359237;
const CM_PER_INCH = 2.54;

/** Rounds to `decimals` places without introducing negative zero. */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function cmToIn(cm: number): number {
  return cm / CM_PER_INCH;
}

export function inToCm(inches: number): number {
  return inches * CM_PER_INCH;
}

export interface FeetInches {
  readonly feet: number;
  readonly inches: number;
}

/** Splits a height in centimetres into whole feet and whole inches (inches round to nearest). */
export function cmToFeetInches(cm: number): FeetInches {
  const totalInches = Math.round(cmToIn(cm));
  const feet = Math.floor(totalInches / 12);
  return { feet, inches: totalInches - feet * 12 };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return inToCm(feet * 12 + inches);
}

export function celsiusToFahrenheit(celsius: number): number {
  return celsius * 1.8 + 32;
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  return (fahrenheit - 32) / 1.8;
}
