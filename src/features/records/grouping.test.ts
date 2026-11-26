import type { RecordSummary } from '@/data';

import { buildTimeline } from './grouping';

function summary(id: string, date: string, title: string): RecordSummary {
  return {
    id,
    date,
    title,
    kind: 'other',
    condition: '',
    doctorId: null,
    followUpOn: null,
    updatedAt: 0,
  };
}

describe('buildTimeline', () => {
  it('inserts one month header per month, in order', () => {
    const items = buildTimeline([
      summary('1', '2026-11-02', 'November'),
      summary('2', '2026-11-01', 'November too'),
      summary('3', '2026-09-30', 'September'),
    ]);

    expect(items.map((item) => (item.type === 'month' ? item.label : item.row.title))).toEqual([
      'November 2026',
      'November',
      'November too',
      'September 2026',
      'September',
    ]);
  });

  it('emits no header for an empty page', () => {
    expect(buildTimeline([])).toEqual([]);
  });

  it('keeps a single header when a month continues across pages', () => {
    const firstPage = buildTimeline([summary('1', '2026-11-02', 'A')]);
    const secondPage = buildTimeline([summary('2', '2026-11-01', 'B')]);
    // Each page is flattened independently, then concatenated by the screen; the duplicate
    // header is the reason the screen groups the accumulated rows rather than each page.
    expect(firstPage).toHaveLength(2);
    expect(secondPage).toHaveLength(2);

    const combined = buildTimeline([
      summary('1', '2026-11-02', 'A'),
      summary('2', '2026-11-01', 'B'),
    ]);
    expect(combined.filter((item) => item.type === 'month')).toHaveLength(1);
  });
});
