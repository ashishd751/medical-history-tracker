/**
 * Domain value → user-facing label.
 *
 * The domain layer deliberately contains no display text, so this is the single place where an
 * enum becomes a word. Screens must use these helpers instead of building their own maps.
 */
import type {
  BloodType,
  BmiCategory,
  BpCategory,
  MeasurementKind,
  MedicationStatus,
  ReadingFlag,
  RecordKind,
  Sex,
} from '@/domain';

import { strings } from './strings';

export function recordKindLabel(kind: RecordKind): string {
  return strings.labels.recordKind[kind];
}

export function sexLabel(sex: Sex): string {
  return strings.labels.sex[sex];
}

export function medicationStatusLabel(status: MedicationStatus): string {
  return strings.labels.medicationStatus[status];
}

export function readingFlagLabel(flag: ReadingFlag): string {
  return strings.labels.flag[flag];
}

export function measurementKindLabel(kind: MeasurementKind): string {
  return strings.labels.measurement[kind];
}

export function bmiCategoryLabel(category: BmiCategory): string {
  return strings.labels.bmi[category];
}

export function bpCategoryLabel(category: BpCategory): string {
  return strings.labels.bp[category];
}

export function bloodTypeLabel(bloodType: BloodType | null): string {
  return bloodType ?? strings.common.notRecorded;
}
