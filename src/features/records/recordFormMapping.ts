/**
 * Translation between the form's string values and the repository's typed input.
 *
 * Keeping this out of the screen means the conversions (imperial → metric, blank → null) are
 * in one reviewable place.
 */
import type { RecordDetail, RecordFormInput, VitalInput } from '@/data';
import { cmToIn, inToCm, kgToLb, lbToKg, type UnitSystem } from '@/domain';
import { todayIso } from '@/lib/dates';

import { EMPTY_RECORD_FORM, type RecordFormValues } from './recordFormSchema';

export interface DraftPayload {
  readonly recordId: string | null;
  readonly values: RecordFormValues;
}

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function num(value: string, unitSystem: UnitSystem, kind: 'height' | 'weight'): number | null {
  const parsed = toNumber(value);
  if (parsed === null) return null;
  if (unitSystem === 'metric') return parsed;
  return kind === 'height' ? inToCm(parsed) : lbToKg(parsed);
}

/** Builds the repository input, dropping rows the user left blank. */
export function toRecordInput(values: RecordFormValues, unitSystem: UnitSystem): RecordFormInput {
  const vitals: VitalInput[] = [];
  const height = num(values.height, unitSystem, 'height');
  if (height !== null) vitals.push({ kind: 'height', v1: height });
  const weight = num(values.weight, unitSystem, 'weight');
  if (weight !== null) vitals.push({ kind: 'weight', v1: weight });
  const systolic = toNumber(values.systolic);
  const diastolic = toNumber(values.diastolic);
  if (systolic !== null && diastolic !== null)
    vitals.push({ kind: 'bp', v1: systolic, v2: diastolic });

  return {
    date: values.date,
    kind: values.kind,
    title: values.title.trim(),
    symptoms: values.symptoms,
    condition: values.condition.trim(),
    facility: values.facility.trim(),
    prescriptionText: values.prescriptionText.trim(),
    comments: values.comments.trim(),
    followUpOn: values.followUpOn.trim() || null,
    medications: values.medications
      .filter((medication) => medication.name.trim().length > 0)
      .map((medication) => ({
        name: medication.name,
        dose: medication.dose,
        frequency: medication.frequency,
        duration: medication.duration,
        startOn: values.date,
      })),
    readings: values.readings
      .filter((reading) => reading.name.trim().length > 0 && reading.value.trim().length > 0)
      .map((reading) => ({
        name: reading.name,
        value: reading.value,
        unit: reading.unit,
        refLow: toNumber(reading.refLow),
        refHigh: toNumber(reading.refHigh),
        flag: reading.flag,
      })),
    vitals,
  };
}

function displayValue(
  value: number | null | undefined,
  unitSystem: UnitSystem,
  kind: 'height' | 'weight',
): string {
  if (value === null || value === undefined) return '';
  const shown = unitSystem === 'metric' ? value : kind === 'height' ? cmToIn(value) : kgToLb(value);
  return String(Math.round(shown * 10) / 10);
}

/** Maps a stored record back into form strings for editing. */
export function toFormValues(
  detail: RecordDetail,
  unitSystem: UnitSystem,
  doctorName: string,
): RecordFormValues {
  const find = (kind: string) => detail.measurements.find((row) => row.kind === kind);
  const height = find('height');
  const weight = find('weight');
  const bp = find('bp');

  return {
    ...EMPTY_RECORD_FORM,
    date: detail.record.date,
    kind: detail.record.kind,
    title: detail.record.title,
    symptoms: [...detail.record.symptoms],
    condition: detail.record.condition,
    doctorName,
    facility: detail.record.facility,
    prescriptionText: detail.record.prescriptionText,
    comments: detail.record.comments,
    followUpOn: detail.record.followUpOn ?? '',
    medications: detail.medications.map((medication) => ({
      name: medication.name,
      dose: medication.dose,
      frequency: medication.frequency,
      duration: medication.duration,
    })),
    readings: detail.readings.map((reading) => ({
      name: reading.name,
      value: reading.value,
      unit: reading.unit,
      refLow: reading.refLow === null ? '' : String(reading.refLow),
      refHigh: reading.refHigh === null ? '' : String(reading.refHigh),
      flag: reading.flag,
    })),
    height: displayValue(height?.v1, unitSystem, 'height'),
    weight: displayValue(weight?.v1, unitSystem, 'weight'),
    systolic: bp ? String(bp.v1) : '',
    diastolic: bp?.v2 !== null && bp?.v2 !== undefined ? String(bp.v2) : '',
  };
}

/** A fresh form for today. */
export function emptyForm(): RecordFormValues {
  return { ...EMPTY_RECORD_FORM, date: todayIso() };
}

/** Parses a stored draft defensively: a corrupt draft is ignored, never fatal. */
export function parseDraft(raw: string | null): DraftPayload | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as Partial<DraftPayload>;
    if (typeof candidate.values !== 'object' || candidate.values === null) return null;
    return {
      recordId: typeof candidate.recordId === 'string' ? candidate.recordId : null,
      values: { ...EMPTY_RECORD_FORM, ...candidate.values },
    };
  } catch {
    return null;
  }
}
