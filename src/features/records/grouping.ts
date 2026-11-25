import type { RecordSummary } from '@/data';
import { formatMonthLabel } from '@/ui';

export interface RecordMonthGroup {
  /** `YYYY-MM`, used only as a React key. */
  readonly key: string;
  /** A textual label such as `November 2026` — not a date (ADR-017). */
  readonly label: string;
  readonly rows: readonly RecordSummary[];
}

/**
 * Groups an already date-sorted list into months, preserving order.
 *
 * The group label is words, never `DD/MM/YYYY`; each row still prints its own date.
 */
export function groupByMonth(rows: readonly RecordSummary[]): RecordMonthGroup[] {
  const groups: { key: string; label: string; rows: RecordSummary[] }[] = [];

  for (const row of rows) {
    const key = row.date.slice(0, 7);
    const last = groups.at(-1);
    if (last && last.key === key) {
      last.rows.push(row);
    } else {
      groups.push({ key, label: formatMonthLabel(row.date), rows: [row] });
    }
  }

  return groups;
}
