import type { RecordSummary } from '@/data';
import { formatMonthLabel } from '@/ui/format';

export type TimelineItem =
  | { readonly type: 'month'; readonly key: string; readonly label: string }
  | { readonly type: 'record'; readonly row: RecordSummary };

/**
 * Flattens the accumulated, already date-sorted pages into rows a virtualised list can render:
 * a month header followed by that month's records.
 *
 * The header is words ("November 2026"), never `DD/MM/YYYY`; each record still prints its own
 * date (ADR-017). Grouping runs over *all* loaded pages, so a month that spans a page boundary
 * still gets exactly one header.
 */
export function buildTimeline(rows: readonly RecordSummary[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  let currentKey: string | null = null;

  for (const row of rows) {
    const key = row.date.slice(0, 7);
    if (key !== currentKey) {
      items.push({ type: 'month', key, label: formatMonthLabel(row.date) });
      currentKey = key;
    }
    items.push({ type: 'record', row });
  }

  return items;
}
