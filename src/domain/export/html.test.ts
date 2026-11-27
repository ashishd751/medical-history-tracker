import { buildExportHtml, EMPTY_CELL, escapeHtml, type ExportHtmlModel, textToHtml } from './html';
import { DEFAULT_EXPORT_COLUMNS, EXPORT_COLUMN_IDS, type ExportColumnId } from './model';

/** A synthetic person and two synthetic records; never real data. */
function model(overrides: Partial<ExportHtmlModel> = {}): ExportHtmlModel {
  return {
    documentTitle: 'Medical history',
    personName: 'Asha Testperson',
    facts: [
      { label: 'Age', value: '36 years' },
      { label: 'Blood type', value: 'O+' },
      { label: 'Height', value: '170 cm' },
      { label: 'Weight', value: '70 kg' },
      { label: 'BMI', value: '24.2 (Normal)' },
      { label: 'Last BP', value: '120/80 mmHg on 01/11/2026' },
      { label: 'Current medication', value: 'Syntheticstatin 10 mg' },
    ],
    summary: '2 records · 01/10/2026 – 02/11/2026',
    exportedOn: 'Exported on 27/11/2026',
    columns: DEFAULT_EXPORT_COLUMNS.map((id) => ({ id, label: id })),
    rows: [
      {
        id: 'r1',
        cells: ['02/11/2026', 'Headache', 'Dr Test', 'Migraine', 'Hb 13.5 g/dL', 'Synthetic'],
      },
      { id: 'r2', cells: ['01/10/2026', 'Cough', '', 'Cold', '', ''] },
    ],
    emptyMessage: 'No records match these filters.',
    disclaimer: 'Informational only, not medical advice.',
    ...overrides,
  };
}

function columns(count: number): ExportHtmlModel['columns'] {
  return EXPORT_COLUMN_IDS.slice(0, count).map((id) => ({ id, label: id }));
}

describe('escapeHtml', () => {
  it('neutralises tags, ampersands and quotes', () => {
    expect(escapeHtml('<script>alert("x" & \'y\')</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;',
    );
  });

  it('leaves ordinary text, Unicode and emoji untouched', () => {
    expect(escapeHtml('Hb 13.5 g/dL — सिरदर्द 🩺')).toBe('Hb 13.5 g/dL — सिरदर्द 🩺');
  });

  it('escapes an ampersand only once', () => {
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });
});

describe('textToHtml', () => {
  it('turns newlines into breaks after escaping', () => {
    expect(textToHtml('first line\nsecond <b>line</b>')).toBe(
      'first line<br>second &lt;b&gt;line&lt;/b&gt;',
    );
  });

  it('normalises CRLF and drops control characters', () => {
    expect(textToHtml('a\r\nb\u0000c\u001fd')).toBe('a<br>bcd');
  });

  it('keeps Devanagari, emoji and right-to-left text', () => {
    expect(textToHtml('दवा 🩺 مرحبا')).toBe('दवा 🩺 مرحبا');
  });
});

describe('buildExportHtml', () => {
  it('produces a well-formed document with a charset and a title', () => {
    const html = buildExportHtml(model());
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<title>Medical history — Asha Testperson</title>');
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('renders the profile header facts', () => {
    const html = buildExportHtml(model());
    for (const fact of model().facts) {
      expect(html).toContain(`<dt>${fact.label}</dt><dd>${fact.value}</dd>`);
    }
    expect(html).toContain('Exported on 27/11/2026');
    expect(html).toContain('2 records · 01/10/2026 – 02/11/2026');
  });

  it('renders one header cell and one body cell per column', () => {
    const html = buildExportHtml(model());
    expect(html.match(/<th scope="col"/g)).toHaveLength(6);
    expect(html).toContain('<td>02/11/2026</td>');
    expect(html).toContain('<td>Hb 13.5 g/dL</td>');
  });

  it('shows a dash for an empty cell', () => {
    expect(buildExportHtml(model())).toContain(`<td>${EMPTY_CELL}</td>`);
  });

  it('keeps the header row repeating and rows unbroken', () => {
    const html = buildExportHtml(model());
    expect(html).toContain('thead { display: table-header-group; }');
    expect(html).toContain('tfoot { display: table-footer-group; }');
    expect(html).toContain('break-inside: avoid');
    expect(html).toContain('page-break-inside: avoid');
  });

  it('carries the disclaimer in a footer spanning every column', () => {
    const html = buildExportHtml(model());
    expect(html).toContain('Informational only, not medical advice.');
    expect(html).toContain('class="disclaimer" colspan="6"');
  });

  it('uses a portrait A4 page up to five columns', () => {
    const html = buildExportHtml(model({ columns: columns(5) }));
    expect(html).toContain('size: A4 portrait');
    expect(html).toContain('colspan="5"');
  });

  it('switches to a landscape A4 page at six columns', () => {
    const html = buildExportHtml(model({ columns: columns(6) }));
    expect(html).toContain('size: A4 landscape');
    expect(html).not.toContain('size: A4 portrait');
  });
});

describe('buildExportHtml with different row counts', () => {
  it('handles one row', () => {
    const html = buildExportHtml(
      model({ rows: [{ id: 'only', cells: ['02/11/2026', 'A', 'B', 'C', 'D', 'E'] }] }),
    );
    expect(html.match(/<tr>/g)).toHaveLength(3); // header, footer, one record
    expect(html).not.toContain('No records match these filters.');
  });

  it('handles no rows without emitting an empty table', () => {
    const html = buildExportHtml(model({ rows: [] }));
    expect(html).toContain('No records match these filters.');
    expect(html).not.toContain('<table>');
    expect(html).not.toContain('<thead>');
  });

  it('renders 1,000 rows across pages, each page with its own table', () => {
    const rows = Array.from({ length: 1000 }, (_, index) => ({
      id: `r${index}`,
      cells: ['02/11/2026', `Symptom ${index}`, 'Dr Test', 'Condition', 'Hb 13.5 g/dL', 'Note'],
    }));
    const html = buildExportHtml(model({ rows }));
    expect(html.match(/<td>02\/11\/2026<\/td>/g)).toHaveLength(1000);
    // Six columns is landscape, so 14 rows a page: 72 pages, each with a header row.
    expect(html.match(/<table/g)).toHaveLength(72);
    expect(html.match(/<th scope="col"/g)).toHaveLength(72 * 6);
  });

  it('starts every page after the first with a forced break', () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({
      id: `r${index}`,
      cells: ['02/11/2026', 'A', 'B', 'C', 'D', 'E'],
    }));
    const html = buildExportHtml(model({ rows }));
    // 30 rows at 14 a page is three pages: the first table has no break class.
    expect(html.match(/<table>/g)).toHaveLength(1);
    expect(html.match(/<table class="page">/g)).toHaveLength(2);
    expect(html).toContain('break-before: page');
  });

  it('tolerates a row with fewer cells than columns', () => {
    const html = buildExportHtml(model({ rows: [{ id: 'short', cells: ['02/11/2026'] }] }));
    expect(html).toContain(`<td>${EMPTY_CELL}</td>`);
    expect(html.match(/<td>/g)).toHaveLength(6);
  });

  it('tolerates no columns at all', () => {
    const html = buildExportHtml(model({ columns: [], rows: [] }));
    expect(html).toContain('No records match these filters.');
    expect(html).toContain('size: A4 portrait');
  });

  it('renders the same document twice for the same model', () => {
    expect(buildExportHtml(model())).toBe(buildExportHtml(model()));
  });

  it('accepts every optional column in the landscape layout', () => {
    const all = EXPORT_COLUMN_IDS.map((id: ExportColumnId) => ({ id, label: id }));
    const cells = EXPORT_COLUMN_IDS.map((id) => `value-${id}`);
    const html = buildExportHtml(model({ columns: all, rows: [{ id: 'x', cells }] }));
    expect(html).toContain('size: A4 landscape');
    expect(html).toContain('<td>value-attachments</td>');
    expect(html.match(/<th scope="col"/g)).toHaveLength(EXPORT_COLUMN_IDS.length);
  });
});

describe('buildExportHtml text safety', () => {
  it('escapes hostile text in every user-controlled field', () => {
    const html = buildExportHtml(
      model({
        personName: '<img src=x onerror="alert(1)">',
        facts: [{ label: 'Note & more', value: '<b>bold</b>' }],
        rows: [{ id: 'x', cells: ['<script>evil()</script>', 'a & b', '"q"', "'s'", '<b>', ''] }],
      }),
    );
    expect(html).not.toContain('<script>evil()</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>bold</b>');
    expect(html).toContain('&lt;script&gt;evil()&lt;/script&gt;');
    expect(html).toContain('a &amp; b');
    expect(html).toContain('&quot;q&quot;');
    expect(html).toContain('&#39;s&#39;');
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('keeps a very long unbroken word, and the CSS lets it wrap inside the cell', () => {
    const longWord = `a${'b'.repeat(400)}c`;
    const html = buildExportHtml(
      model({ rows: [{ id: 'x', cells: [longWord, '', '', '', '', ''] }] }),
    );
    expect(html).toContain(longWord);
    expect(html).toContain('overflow-wrap: anywhere');
    expect(html).toContain('word-break: break-word');
  });

  it('keeps Devanagari, emoji and right-to-left text verbatim', () => {
    const hindi = 'सिरदर्द और बुखार';
    const emoji = '🩺💊';
    const arabic = 'صداع';
    const html = buildExportHtml(
      model({ rows: [{ id: 'x', cells: [hindi, emoji, arabic, '', '', ''] }] }),
    );
    expect(html).toContain(hindi);
    expect(html).toContain(emoji);
    expect(html).toContain(arabic);
    expect(html).toContain('unicode-bidi: plaintext');
  });

  it('keeps a newline inside a comment as a line break', () => {
    const html = buildExportHtml(
      model({ rows: [{ id: 'x', cells: ['date', 'a', 'b', 'c', 'd', 'line one\nline two'] }] }),
    );
    expect(html).toContain('line one<br>line two');
  });
});
