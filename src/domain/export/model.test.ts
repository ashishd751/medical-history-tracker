import {
  A4_LANDSCAPE,
  A4_PORTRAIT,
  columnWidths,
  compareExportRecords,
  DEFAULT_EXPORT_COLUMNS,
  DEFAULT_EXPORT_SORT,
  EXPORT_COLUMN_IDS,
  EXPORT_ROWS_PER_PAGE,
  type ExportColumnId,
  normalizeExportColumns,
  orientationFor,
  pageSizeFor,
  rowsPerPageFor,
  sortExportRecords,
} from './model';

describe('the export column model', () => {
  it('defaults to the six columns FR-10 names, in table order', () => {
    expect(DEFAULT_EXPORT_COLUMNS).toEqual([
      'date',
      'symptoms',
      'doctor',
      'condition',
      'readings',
      'comments',
    ]);
  });

  it('offers every column once, date first', () => {
    expect(new Set(EXPORT_COLUMN_IDS).size).toBe(EXPORT_COLUMN_IDS.length);
    expect(EXPORT_COLUMN_IDS[0]).toBe('date');
  });

  describe('normalizeExportColumns', () => {
    it('drops unknown ids', () => {
      expect(normalizeExportColumns(['date', 'nope', 42, null])).toEqual(['date']);
    });

    it('removes duplicates', () => {
      expect(normalizeExportColumns(['comments', 'date', 'comments'])).toEqual([
        'date',
        'comments',
      ]);
    });

    it('restores the canonical table order rather than the order columns were ticked', () => {
      expect(normalizeExportColumns(['comments', 'type', 'date'])).toEqual([
        'date',
        'type',
        'comments',
      ]);
    });

    it('falls back to the defaults for an empty, unusable or unparseable value', () => {
      expect(normalizeExportColumns([])).toEqual(DEFAULT_EXPORT_COLUMNS);
      expect(normalizeExportColumns(['unknown'])).toEqual(DEFAULT_EXPORT_COLUMNS);
      expect(normalizeExportColumns('date')).toEqual(DEFAULT_EXPORT_COLUMNS);
      expect(normalizeExportColumns(null)).toEqual(DEFAULT_EXPORT_COLUMNS);
      expect(normalizeExportColumns(undefined)).toEqual(DEFAULT_EXPORT_COLUMNS);
    });

    it('keeps a deliberate single-column selection', () => {
      expect(normalizeExportColumns(['comments'])).toEqual(['comments']);
    });

    it('accepts every column', () => {
      expect(normalizeExportColumns([...EXPORT_COLUMN_IDS])).toEqual([...EXPORT_COLUMN_IDS]);
    });
  });

  describe('orientation', () => {
    it.each([
      [0, 'portrait'],
      [1, 'portrait'],
      [5, 'portrait'],
      [6, 'landscape'],
      [12, 'landscape'],
    ])('%i columns is %s', (count, expected) => {
      expect(orientationFor(count)).toBe(expected);
    });

    it('swaps the A4 page size for landscape', () => {
      expect(pageSizeFor(5)).toEqual(A4_PORTRAIT);
      expect(pageSizeFor(6)).toEqual(A4_LANDSCAPE);
      // 210 × 297 mm in points at 72 PPI, rounded to whole points.
      expect(A4_PORTRAIT).toEqual({ width: 595, height: 842 });
      expect(A4_LANDSCAPE).toEqual({ width: 842, height: 595 });
    });

    it('puts fewer records on a landscape page', () => {
      expect(rowsPerPageFor(5)).toBe(EXPORT_ROWS_PER_PAGE.portrait);
      expect(rowsPerPageFor(6)).toBe(EXPORT_ROWS_PER_PAGE.landscape);
      expect(EXPORT_ROWS_PER_PAGE.landscape).toBeLessThan(EXPORT_ROWS_PER_PAGE.portrait);
      // Below the ~20 rows a landscape page physically holds, so a page cannot overflow and lose
      // its header row on iOS (ADR-048).
      expect(EXPORT_ROWS_PER_PAGE.landscape).toBeLessThan(20);
    });
  });

  describe('columnWidths', () => {
    it('returns one width per column, adding up to 100%', () => {
      const widths = columnWidths(DEFAULT_EXPORT_COLUMNS);
      expect(widths).toHaveLength(DEFAULT_EXPORT_COLUMNS.length);
      const total = widths.reduce((sum, width) => sum + Number.parseFloat(width), 0);
      expect(total).toBeCloseTo(100, 1);
    });

    it('gives the readings column more room than the date column', () => {
      const widths = columnWidths(['date', 'readings']);
      expect(Number.parseFloat(widths[1] ?? '0')).toBeGreaterThan(
        Number.parseFloat(widths[0] ?? '0'),
      );
    });

    it('returns nothing for no columns', () => {
      expect(columnWidths([])).toEqual([]);
    });
  });

  describe('sorting', () => {
    const rows = [
      { id: 'b', date: '2026-01-02', createdAt: 2 },
      { id: 'c', date: '2026-05-01', createdAt: 3 },
      { id: 'a', date: '2026-01-02', createdAt: 1 },
    ];

    it('defaults to newest first', () => {
      expect(DEFAULT_EXPORT_SORT).toBe('newest');
      expect(sortExportRecords(rows, 'newest').map((row) => row.id)).toEqual(['c', 'b', 'a']);
    });

    it('flips to oldest first', () => {
      expect(sortExportRecords(rows, 'oldest').map((row) => row.id)).toEqual(['a', 'b', 'c']);
    });

    it('breaks a same-day tie by creation time, then id', () => {
      const sameTime = [
        { id: 'z', date: '2026-01-02', createdAt: 7 },
        { id: 'y', date: '2026-01-02', createdAt: 7 },
      ];
      expect(sortExportRecords(sameTime, 'newest').map((row) => row.id)).toEqual(['y', 'z']);
      const first = sameTime[0];
      if (!first) throw new Error('missing row');
      expect(compareExportRecords(first, first, 'newest')).toBe(0);
    });

    it('does not mutate the input', () => {
      const input = [...rows];
      sortExportRecords(input, 'newest');
      expect(input).toEqual(rows);
    });

    it('is a total order: comparing every pair never contradicts itself', () => {
      const sorted = sortExportRecords(rows, 'oldest');
      for (let i = 1; i < sorted.length; i += 1) {
        const previous = sorted[i - 1];
        const current = sorted[i];
        if (!previous || !current) throw new Error('missing row');
        expect(compareExportRecords(previous, current, 'oldest')).toBeLessThanOrEqual(0);
      }
    });
  });

  it('accepts every column id as a type', () => {
    const all: readonly ExportColumnId[] = EXPORT_COLUMN_IDS;
    expect(all).toHaveLength(13);
  });
});
