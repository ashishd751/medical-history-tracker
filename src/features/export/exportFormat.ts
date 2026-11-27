/**
 * Turning stored rows into the strings that go into the PDF (Phase 4).
 *
 * This sits in the feature, not the domain, because every value here needs display text (unit
 * symbols, enum labels, `DD/MM/YYYY`) and the domain layer owns no user-facing string. The
 * *layout* — escaping, columns, sorting, page size — is in `src/domain/export` (ADR-047).
 *
 * Cells are plain strings; `buildExportHtml` escapes them and renders an empty string as a dash.
 */
import {
  ageInYears,
  type ExportColumnId,
  type ExportFact,
  type ExportTableRow,
  type MeasurementKind,
  type ProfileSnapshot,
  type ReadingFlag,
  type RecordKind,
  roundTo,
  type UnitSystem,
} from '@/domain';
import { formatDisplayDate } from '@/lib/dates';
import {
  bloodTypeLabel,
  bmiCategoryLabel,
  exportVitalLabel,
  formatBloodPressure,
  formatBmi,
  formatHeight,
  formatMeasurement,
  formatWeight,
  readingFlagLabel,
  recordKindLabel,
  strings,
} from '@/ui';

/** The parts of a stored row an export needs; the repositories' rows satisfy these. */
export interface ExportReadingLike {
  readonly name: string;
  readonly value: string;
  readonly unit: string;
  readonly refLow: number | null;
  readonly refHigh: number | null;
  readonly flag: ReadingFlag;
}

export interface ExportMedicationLike {
  readonly name: string;
  readonly dose: string;
  readonly frequency: string;
}

export interface ExportMeasurementLike {
  readonly kind: MeasurementKind;
  readonly v1: number;
  readonly v2: number | null;
}

/** One record with its children already grouped by the bulk loader. */
export interface ExportRecordSource {
  readonly id: string;
  readonly date: string;
  readonly kind: RecordKind;
  readonly title: string;
  readonly symptoms: readonly string[];
  readonly condition: string;
  readonly facility: string;
  readonly comments: string;
  readonly followUpOn: string | null;
  /** Null when the record has no doctor or the doctor row was deleted. */
  readonly doctorName: string | null;
  readonly medications: readonly ExportMedicationLike[];
  readonly readings: readonly ExportReadingLike[];
  readonly measurements: readonly ExportMeasurementLike[];
  readonly attachmentCount: number;
  readonly attachmentNames: readonly string[];
}

export interface ExportFormatContext {
  readonly unitSystem: UnitSystem;
}

function formatReferenceRange(low: number | null, high: number | null): string {
  if (low === null && high === null) return '';
  return ` (${low ?? ''}–${high ?? ''})`;
}

/**
 * One lab reading: `Hb 13.5 g/dL (13–17)` or `LDL 142 mg/dL (70–100) — High`.
 *
 * A High/Low flag is written as a word, never colour alone (FR-10), and "Normal" is left out:
 * on a compact page it is the default, and the noise would bury the two results that matter.
 */
export function formatExportReading(reading: ExportReadingLike): string {
  const head = `${reading.name} ${reading.value}`.trim();
  const unit = reading.unit.trim();
  const flagged =
    reading.flag === 'low' || reading.flag === 'high' ? ` — ${readingFlagLabel(reading.flag)}` : '';
  return `${unit ? `${head} ${unit}` : head}${formatReferenceRange(reading.refLow, reading.refHigh)}${flagged}`;
}

/** All readings of one record, joined with a bar so one cell stays one line where it fits. */
export function formatExportReadings(readings: readonly ExportReadingLike[]): string {
  return readings.map(formatExportReading).join(' | ');
}

/** `Metformin 500 mg, twice a day`; several medications are separated by a bar. */
export function formatExportMedications(medications: readonly ExportMedicationLike[]): string {
  return medications
    .map((medication) => {
      const name = medication.name.trim();
      const dose = medication.dose.trim();
      const frequency = medication.frequency.trim();
      const withDose = dose ? `${name} ${dose}` : name;
      return frequency ? `${withDose}, ${frequency}` : withDose;
    })
    .join(' | ');
}

function formatVital(measurement: ExportMeasurementLike, unitSystem: UnitSystem): string {
  const name = exportVitalLabel(measurement.kind);
  // A single-number BP row cannot be written as systolic/diastolic; show the number it has.
  if (measurement.kind === 'bp' && measurement.v2 === null) {
    return `${name} ${roundTo(measurement.v1, 0)} mmHg`;
  }
  return `${name} ${formatMeasurement(measurement.kind, measurement.v1, measurement.v2, unitSystem)}`;
}

/** `BP 120/80 mmHg | Pulse 72 bpm | Temp 36.8 °C`, converted at display time only. */
export function formatExportVitals(
  measurements: readonly ExportMeasurementLike[],
  unitSystem: UnitSystem,
): string {
  return measurements.map((measurement) => formatVital(measurement, unitSystem)).join(' | ');
}

/**
 * `2 files: report.pdf, scan.jpg` (at most three names, then a count of the rest).
 *
 * The attachments column is optional and off by default: a PDF with a dozen long file names is
 * unreadable at five columns, and the files themselves are not embedded (ADR-049).
 */
export function formatExportAttachments(count: number, names: readonly string[]): string {
  if (count <= 0) return '';
  const label = `${count} file${count === 1 ? '' : 's'}`;
  if (names.length === 0) return label;
  const shown = names.slice(0, 3).join(', ');
  const rest = names.length > 3 ? ` +${names.length - 3}` : '';
  return `${label}: ${shown}${rest}`;
}

/** One cell. An empty string means "nothing recorded" and prints as a dash. */
export function exportCell(
  column: ExportColumnId,
  record: ExportRecordSource,
  context: ExportFormatContext,
): string {
  switch (column) {
    case 'date':
      return formatDisplayDate(record.date);
    case 'title':
      return record.title;
    case 'type':
      return recordKindLabel(record.kind);
    case 'symptoms':
      return record.symptoms.join(', ');
    case 'doctor':
      return record.doctorName ?? '';
    case 'condition':
      return record.condition;
    case 'readings':
      return formatExportReadings(record.readings);
    case 'medications':
      return formatExportMedications(record.medications);
    case 'vitals':
      return formatExportVitals(record.measurements, context.unitSystem);
    case 'facility':
      return record.facility;
    case 'followUp':
      return record.followUpOn === null ? '' : formatDisplayDate(record.followUpOn);
    case 'comments':
      return record.comments;
    case 'attachments':
      return formatExportAttachments(record.attachmentCount, record.attachmentNames);
  }
}

export function buildExportRows(
  records: readonly ExportRecordSource[],
  columns: readonly ExportColumnId[],
  context: ExportFormatContext,
): ExportTableRow[] {
  return records.map((record) => ({
    id: record.id,
    cells: columns.map((column) => exportCell(column, record, context)),
  }));
}

export interface ExportFactsInput {
  readonly snapshot: ProfileSnapshot;
  /** `YYYY-MM-DD`; the device's local date. */
  readonly today: string;
  /** `YYYY-MM-DD` from the person row. */
  readonly dob: string;
  readonly unitSystem: UnitSystem;
}

/**
 * The header block: the same values Home and Profile show, in the user's units.
 *
 * A missing value is written as "Not recorded" rather than dropped, so two exports of the same
 * person always have the same shape and a reader looking for a blood type sees that there is none.
 */
export function buildExportFacts({
  snapshot,
  today,
  dob,
  unitSystem,
}: ExportFactsInput): ExportFact[] {
  const notRecorded = strings.common.notRecorded;
  const bloodPressure = snapshot.bloodPressure;
  const age = ageInYears(dob, today);

  return [
    {
      label: strings.export.factAge,
      value: age === null ? notRecorded : strings.export.years(age),
    },
    { label: strings.export.factBloodType, value: bloodTypeLabel(snapshot.bloodType) },
    {
      label: strings.export.factHeight,
      value: snapshot.heightCm === null ? notRecorded : formatHeight(snapshot.heightCm, unitSystem),
    },
    {
      label: strings.export.factWeight,
      value: snapshot.weightKg === null ? notRecorded : formatWeight(snapshot.weightKg, unitSystem),
    },
    {
      label: strings.export.factBmi,
      value:
        snapshot.bmi === null || snapshot.bmiCategory === null
          ? notRecorded
          : `${formatBmi(snapshot.bmi)} (${bmiCategoryLabel(snapshot.bmiCategory)})`,
    },
    {
      label: strings.export.factLastBp,
      value:
        bloodPressure === null
          ? notRecorded
          : `${formatBloodPressure(bloodPressure.systolic, bloodPressure.diastolic)} ${strings.export.bpOn(
              formatDisplayDate(bloodPressure.measuredOn),
            )}`,
    },
    {
      label: strings.export.factMedication,
      value:
        snapshot.medications.length === 0
          ? strings.common.none
          : snapshot.medications.map((medication) => medication.name).join(', '),
    },
  ];
}

/** The period line under the header: `01/01/2025 – 27/11/2026`, or "all dates". */
export function formatExportRange(from: string | undefined, to: string | undefined): string {
  if (from && to) return strings.export.range(formatDisplayDate(from), formatDisplayDate(to));
  if (from) return strings.export.fromDate(formatDisplayDate(from));
  if (to) return strings.export.untilDate(formatDisplayDate(to));
  return strings.export.allTimeRange;
}
