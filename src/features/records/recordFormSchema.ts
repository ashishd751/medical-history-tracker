/**
 * The record form's Zod schema — the validation boundary for anything a user can type.
 *
 * Numbers are kept as strings while editing so a half-typed "17" is not coerced to a value;
 * they are validated, then converted to canonical metric units in `toRecordInput`.
 */
import { z } from 'zod';

import {
  inRange,
  MAX_LONG_TEXT,
  MAX_NAME,
  MAX_SHORT_TEXT,
  type NumericRange,
  READING_FLAGS,
  RECORD_KINDS,
  type UnitSystem,
} from '@/domain';
import { isValidIsoDate } from '@/lib/dates';

/** Display-unit ranges, converted to metric bounds so imperial input is validated correctly. */
function displayRange(metric: NumericRange, unitSystem: UnitSystem, imperialFactor: number) {
  if (unitSystem === 'metric') return metric;
  return { min: metric.min / imperialFactor, max: metric.max / imperialFactor };
}

function numberText(range: NumericRange, message: string) {
  return z
    .string()
    .trim()
    .refine(
      (value) => value === '' || (Number.isFinite(Number(value)) && inRange(Number(value), range)),
      {
        message,
      },
    );
}

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.45359237;

export function createRecordFormSchema(unitSystem: UnitSystem) {
  const heightRange = displayRange(
    { min: 30, max: 275 },
    unitSystem,
    unitSystem === 'metric' ? 1 : CM_PER_INCH,
  );
  const weightRange = displayRange(
    { min: 1, max: 400 },
    unitSystem,
    unitSystem === 'metric' ? 1 : KG_PER_LB,
  );

  return z.object({
    date: z.string().refine(isValidIsoDate, 'Choose a valid date'),
    kind: z.enum(RECORD_KINDS),
    title: z.string().trim().min(1, 'required').max(MAX_NAME),
    symptoms: z.array(z.string().trim().min(1)).max(30),
    condition: z.string().max(MAX_SHORT_TEXT),
    doctorName: z.string().max(MAX_NAME),
    specialty: z.string().max(MAX_SHORT_TEXT),
    facility: z.string().max(MAX_SHORT_TEXT),
    prescriptionText: z.string().max(MAX_LONG_TEXT),
    comments: z.string().max(MAX_LONG_TEXT),
    /** Empty string means "no follow-up". */
    followUpOn: z.string(),
    medications: z
      .array(
        z.object({
          name: z.string().max(MAX_NAME),
          dose: z.string().max(MAX_SHORT_TEXT),
          frequency: z.string().max(MAX_SHORT_TEXT),
          duration: z.string().max(MAX_SHORT_TEXT),
        }),
      )
      .max(40),
    readings: z
      .array(
        z.object({
          name: z.string().max(MAX_NAME),
          value: z.string().max(MAX_SHORT_TEXT),
          unit: z.string().max(32),
          refLow: z.string().max(32),
          refHigh: z.string().max(32),
          flag: z.enum(READING_FLAGS),
        }),
      )
      .max(80),
    height: numberText(
      heightRange,
      `Use ${Math.round(heightRange.min)}–${Math.round(heightRange.max)}`,
    ),
    weight: numberText(
      weightRange,
      `Use ${Math.round(weightRange.min)}–${Math.round(weightRange.max)}`,
    ),
    systolic: numberText({ min: 50, max: 300 }, 'Use 50–300'),
    diastolic: numberText({ min: 20, max: 200 }, 'Use 20–200'),
  });
}

export type RecordFormValues = z.infer<ReturnType<typeof createRecordFormSchema>>;

export const EMPTY_RECORD_FORM: RecordFormValues = {
  date: '',
  kind: 'doctor_visit',
  title: '',
  symptoms: [],
  condition: '',
  doctorName: '',
  specialty: '',
  facility: '',
  prescriptionText: '',
  comments: '',
  followUpOn: '',
  medications: [],
  readings: [],
  height: '',
  weight: '',
  systolic: '',
  diastolic: '',
};
