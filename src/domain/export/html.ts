/**
 * HTML for the exported PDF (Phase 4).
 *
 * `buildExportHtml` is a pure string function: the same model always produces the same document,
 * and every piece of user text is escaped once, here. The pieces of the document that need
 * labels and formatted numbers (the profile facts, the row cells) arrive already rendered, so
 * this module stays free of display text — the domain never owns a user-facing string.
 *
 * Layout constraints from FR-10:
 * - the header block sits above one table;
 * - the header row repeats on every page (`thead { display: table-header-group }`);
 * - a record never splits across pages (`tr { break-inside: avoid }`);
 * - portrait up to five columns, landscape beyond that (the caller also passes the matching page
 *   size to the printer — CSS `@page` alone is not enough on iOS).
 */
import { columnWidths, type ExportColumnId, orientationFor } from './model';

/** An empty cell is a dash, never a blank that reads like a rendering bug. */
export const EMPTY_CELL = '—';

export interface ExportFact {
  readonly label: string;
  readonly value: string;
}

export interface ExportTableColumn {
  readonly id: ExportColumnId;
  readonly label: string;
}

export interface ExportTableRow {
  /** Stable key; never rendered. */
  readonly id: string;
  /** One entry per column, in `columns` order. An empty string renders as a dash. */
  readonly cells: readonly string[];
}

export interface ExportHtmlModel {
  /** `<title>` and the small line above the person's name, e.g. "Medical history". */
  readonly documentTitle: string;
  readonly personName: string;
  /** Age, blood type, height, weight, BMI, last BP, current medication — in the user's units. */
  readonly facts: readonly ExportFact[];
  /** "42 records · 01/01/2025 – 27/11/2026". */
  readonly summary: string;
  /** "Exported on 27/11/2026". */
  readonly exportedOn: string;
  readonly columns: readonly ExportTableColumn[];
  readonly rows: readonly ExportTableRow[];
  /** Shown instead of the table when nothing matches. */
  readonly emptyMessage: string;
  /** "Informational only, not medical advice." */
  readonly disclaimer: string;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes the five characters that can change the meaning of an HTML string.
 *
 * A symptom list, a comment or a doctor's name is free text typed by a user; `<script>` in it
 * must render as those eight characters, never execute or swallow the rest of the table.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

/**
 * Free text inside a table cell: escaped, control characters dropped, newlines kept as breaks.
 *
 * `comments` is a multi-line field on the form, and collapsing it to one line loses the shape the
 * user typed. Tabs and stray control bytes would confuse the WebView's line breaking instead.
 */
export function textToHtml(value: string): string {
  const cleaned = value
    .replace(/\r\n?/g, '\n')
    // Stripping C0 controls is the point of this expression: they would confuse line breaking.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return escapeHtml(cleaned).replace(/\n/g, '<br>');
}

/**
 * Page rules.
 *
 * `@page size` tells Android's WebView the paper and orientation; `printToFileAsync`'s
 * `width`/`height` do the same on iOS. Both are set from the same decision (ADR-048).
 */
function pageCss(orientation: 'portrait' | 'landscape'): string {
  return `@page { size: A4 ${orientation}; margin: 10mm 8mm; }`;
}

function styles(orientation: 'portrait' | 'landscape'): string {
  return `${pageCss(orientation)}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #ffffff; color: #111111; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", Roboto,
    "Noto Sans", "Noto Sans Devanagari", "Noto Sans Tamil", "Noto Sans Arabic", "Noto Sans SC",
    "Apple Color Emoji", "Noto Color Emoji", sans-serif;
  font-size: 8.5pt;
  line-height: 1.35;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.header { border-bottom: 1.2pt solid #111111; padding-bottom: 5pt; margin-bottom: 8pt; }
.eyebrow { margin: 0; font-size: 8pt; letter-spacing: 0.08em; text-transform: uppercase; color: #555555; }
.person { margin: 2pt 0 4pt; font-size: 16pt; font-weight: 700; }
.facts { display: flex; flex-wrap: wrap; gap: 0 14pt; margin: 0; padding: 0; }
.fact { min-width: 72pt; margin: 0 0 3pt; }
.fact dt { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.04em; color: #555555; }
.fact dd { margin: 0; font-size: 9pt; font-weight: 600; }
.summary { margin: 4pt 0 0; font-size: 8.5pt; }
.exported { margin: 1pt 0 0; font-size: 7.5pt; color: #555555; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tfoot { display: table-footer-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th, td {
  border-bottom: 0.5pt solid #bbbbbb;
  padding: 3pt 4pt;
  text-align: left;
  vertical-align: top;
}
th {
  font-size: 7.5pt;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1pt solid #444444;
  background: #eeeeee;
}
td {
  overflow-wrap: anywhere;
  word-break: break-word;
  /* A Hebrew or Arabic value inside a left-to-right table keeps its own direction, so its
     punctuation lands on the correct side instead of jumping to the end of the cell. */
  unicode-bidi: plaintext;
}
tbody tr:nth-child(even) td { background: #f7f7f7; }
.disclaimer { border-bottom: none; padding-top: 6pt; font-size: 7.5pt; color: #555555; }
.empty { margin: 12pt 0; font-size: 10pt; }`;
}

/**
 * The whole document.
 *
 * Rows are pushed into an array and joined once: a 1,000-record export is a few hundred kilobytes
 * of HTML, and repeatedly appending to a string that size is the slow way to build it.
 */
export function buildExportHtml(model: ExportHtmlModel): string {
  const orientation = orientationFor(model.columns.length);
  const widths = columnWidths(model.columns.map((column) => column.id));
  const columnCount = Math.max(model.columns.length, 1);

  const head = model.columns
    .map(
      (column, index) =>
        `<th scope="col" style="width:${widths[index] ?? 'auto'}">${escapeHtml(column.label)}</th>`,
    )
    .join('');

  const body = model.rows.map((row) => {
    const cells = model.columns
      .map((_, index) => {
        const value = row.cells[index] ?? '';
        return `<td>${value === '' ? EMPTY_CELL : textToHtml(value)}</td>`;
      })
      .join('');
    return `<tr>${cells}</tr>`;
  });

  const facts = model.facts
    .map(
      (fact) =>
        `<div class="fact"><dt>${escapeHtml(fact.label)}</dt><dd>${textToHtml(fact.value)}</dd></div>`,
    )
    .join('');

  const table =
    model.rows.length === 0
      ? `<p class="empty">${escapeHtml(model.emptyMessage)}</p>`
      : `<table>
  <thead><tr>${head}</tr></thead>
  <tfoot><tr><td class="disclaimer" colspan="${columnCount}">${escapeHtml(model.disclaimer)}</td></tr></tfoot>
  <tbody>${body.join('')}</tbody>
</table>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(`${model.documentTitle} — ${model.personName}`)}</title>
<style>${styles(orientation)}</style>
</head>
<body>
<header class="header">
<p class="eyebrow">${escapeHtml(model.documentTitle)}</p>
<h1 class="person">${escapeHtml(model.personName)}</h1>
<dl class="facts">${facts}</dl>
<p class="summary">${escapeHtml(model.summary)}</p>
<p class="exported">${escapeHtml(model.exportedOn)}</p>
</header>
${table}
</body>
</html>
`;
}
