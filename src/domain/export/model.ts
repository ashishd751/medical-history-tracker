/**
 * The export model (Phase 4): which columns a PDF carries, in what order, and how rows sort.
 *
 * The PDF is a *report*, not a screen, so it has its own model: the six columns of FR-10 by
 * default, the optional ones on request, and a page that turns landscape once the table outgrows
 * a portrait A4 page. Everything here is pure — the row *contents* are formatted in
 * `src/features/export` because they need unit text and labels from `src/ui`.
 */
import { roundTo } from '../units';

/**
 * Every column the export can carry, in the order a table reads naturally.
 *
 * `date` is deliberately first: it is the sort key, and a table without a date is unreadable.
 */
export const EXPORT_COLUMN_IDS = [
  'date',
  'title',
  'type',
  'symptoms',
  'doctor',
  'condition',
  'readings',
  'medications',
  'vitals',
  'facility',
  'followUp',
  'comments',
  'attachments',
] as const;
export type ExportColumnId = (typeof EXPORT_COLUMN_IDS)[number];

/** FR-10's default table: Date, Symptoms, Doctor, Identified condition, Test readings, Comments. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumnId[] = [
  'date',
  'symptoms',
  'doctor',
  'condition',
  'readings',
  'comments',
];

/** Five columns fit an A4 portrait page; a sixth switches the document to landscape (FR-10). */
export const MAX_PORTRAIT_COLUMNS = 5;

export type ExportOrientation = 'portrait' | 'landscape';

export function isExportColumnId(value: string): value is ExportColumnId {
  return (EXPORT_COLUMN_IDS as readonly string[]).includes(value);
}

/**
 * Cleans a column selection: keeps the known ids, drops duplicates and anything unknown, and
 * restores the canonical order (a table should not reshuffle because of the order columns were
 * ticked). An empty or unusable selection falls back to the defaults, so a corrupt stored value
 * can never produce a PDF with no table at all.
 */
export function normalizeExportColumns(value: unknown): readonly ExportColumnId[] {
  if (!Array.isArray(value)) return DEFAULT_EXPORT_COLUMNS;
  const picked = new Set<ExportColumnId>();
  for (const item of value) {
    if (typeof item === 'string' && isExportColumnId(item)) picked.add(item);
  }
  if (picked.size === 0) return DEFAULT_EXPORT_COLUMNS;
  return EXPORT_COLUMN_IDS.filter((id) => picked.has(id));
}

export function orientationFor(columnCount: number): ExportOrientation {
  return columnCount > MAX_PORTRAIT_COLUMNS ? 'landscape' : 'portrait';
}

export interface PageSize {
  /** Points at 72 PPI — the unit `expo-print`'s `width` and `height` options use. */
  readonly width: number;
  readonly height: number;
}

/** A4 is 210 × 297 mm, which is 595 × 842 pt at 72 PPI. */
export const A4_PORTRAIT: PageSize = { width: 595, height: 842 };
export const A4_LANDSCAPE: PageSize = { width: 842, height: 595 };

export function pageSizeFor(columnCount: number): PageSize {
  return orientationFor(columnCount) === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;
}

/**
 * Relative column widths.
 *
 * With `table-layout: fixed` the browser splits a table into equal columns unless told otherwise,
 * which gives a two-word date the same space as a paragraph of comments. These weights keep short
 * columns short; `columnWidths` normalises them so the row always adds up to 100%.
 */
const COLUMN_WEIGHTS: Record<ExportColumnId, number> = {
  date: 8,
  title: 14,
  type: 9,
  symptoms: 15,
  doctor: 10,
  condition: 12,
  readings: 17,
  medications: 12,
  vitals: 12,
  facility: 10,
  followUp: 9,
  comments: 15,
  attachments: 9,
};

/** Percentage widths for `<col>`, in the same order as `columns`. */
export function columnWidths(columns: readonly ExportColumnId[]): string[] {
  if (columns.length === 0) return [];
  const total = columns.reduce((sum, id) => sum + COLUMN_WEIGHTS[id], 0);
  return columns.map((id) => `${roundTo((COLUMN_WEIGHTS[id] / total) * 100, 2)}%`);
}

export const EXPORT_SORT_ORDERS = ['newest', 'oldest'] as const;
export type ExportSortOrder = (typeof EXPORT_SORT_ORDERS)[number];

/** FR-10: most recent first by default; the user can flip it. */
export const DEFAULT_EXPORT_SORT: ExportSortOrder = 'newest';

/** What sorting needs from a record: its date, and a tie-breaker that never moves between reads. */
export interface ExportSortable {
  readonly id: string;
  /** `YYYY-MM-DD`; lexicographic comparison is correct for zero-padded dates. */
  readonly date: string;
  readonly createdAt: number;
}

/**
 * Newest or oldest first, with same-day records ordered by creation (then id) so the table is
 * identical every time the same export runs.
 */
export function compareExportRecords(
  a: ExportSortable,
  b: ExportSortable,
  order: ExportSortOrder,
): number {
  const direction = order === 'newest' ? -1 : 1;
  if (a.date !== b.date) return a.date < b.date ? -direction : direction;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -direction : direction;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

export function sortExportRecords<T extends ExportSortable>(
  rows: readonly T[],
  order: ExportSortOrder,
): T[] {
  return [...rows].sort((a, b) => compareExportRecords(a, b, order));
}
