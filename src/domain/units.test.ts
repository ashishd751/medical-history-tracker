import {
  celsiusToFahrenheit,
  cmToFeetInches,
  cmToIn,
  fahrenheitToCelsius,
  feetInchesToCm,
  inToCm,
  kgToLb,
  lbToKg,
  roundTo,
} from './units';

describe('mass conversion', () => {
  it('converts kilograms to pounds and back', () => {
    expect(kgToLb(70)).toBeCloseTo(154.3236, 4);
    expect(lbToKg(154.3236)).toBeCloseTo(70, 4);
    expect(lbToKg(kgToLb(82.4))).toBeCloseTo(82.4, 10);
  });
});

describe('length conversion', () => {
  it('converts centimetres to inches and back', () => {
    expect(cmToIn(170)).toBeCloseTo(66.9291, 4);
    expect(inToCm(66.9291)).toBeCloseTo(170, 3);
  });

  it('splits centimetres into feet and inches', () => {
    expect(cmToFeetInches(170)).toEqual({ feet: 5, inches: 7 });
    expect(cmToFeetInches(152.4)).toEqual({ feet: 5, inches: 0 });
    expect(cmToFeetInches(90)).toEqual({ feet: 2, inches: 11 });
  });

  it('round-trips feet and inches to centimetres', () => {
    expect(feetInchesToCm(5, 7)).toBeCloseTo(170.18, 2);
    expect(feetInchesToCm(5, 0)).toBeCloseTo(152.4, 2);
  });
});

describe('temperature conversion', () => {
  it('converts Celsius to Fahrenheit and back', () => {
    expect(celsiusToFahrenheit(37)).toBeCloseTo(98.6, 6);
    expect(fahrenheitToCelsius(98.6)).toBeCloseTo(37, 6);
    expect(celsiusToFahrenheit(0)).toBe(32);
  });
});

describe('roundTo', () => {
  it('rounds to the requested number of decimals', () => {
    expect(roundTo(22.456, 1)).toBe(22.5);
    expect(roundTo(22.44, 1)).toBe(22.4);
    expect(roundTo(154.3236, 2)).toBe(154.32);
    expect(roundTo(7.5, 0)).toBe(8);
  });

  it('never returns negative zero', () => {
    const value = roundTo(-0.04, 1);
    expect(value).toBe(0);
    expect(Object.is(value, -0)).toBe(false);
  });
});
