/**
 * The exported file's name (Phase 4).
 *
 * `printToFileAsync` names its output `<uuid>.pdf`; a user who shares a PDF should see what it is
 * and whose it is, so the file is moved to `medical-history-<person>-YYYYMMDD.pdf` before the share
 * sheet opens. Everything here is a pure string function: no file system, no date maths.
 */

/** A PDF name the share sheet and every file browser can show. */
export const EXPORT_FILE_PREFIX = 'medical-history';

/**
 * A file-name-safe fragment of a person's name.
 *
 * Lower-case ASCII letters and digits survive; everything else becomes a dash. A Hindi or emoji
 * name has no ASCII form, so it becomes `person` rather than a row of dashes — the date still
 * identifies the file, and the PDF itself carries the name.
 */
export function exportFileSlug(name: string): string {
  const slug = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug === '' ? 'person' : slug;
}

/**
 * `medical-history-asha-testperson-20261127.pdf`.
 *
 * An unreadable date falls back to `export`, so a bad caller cannot produce a name with a slash or
 * a dot in it (a path traversal would end up outside the export folder).
 */
export function buildExportFileName(personName: string, isoDate: string): string {
  const digits = isoDate.replace(/[^0-9]/g, '').slice(0, 8);
  const stamp = digits.length === 8 ? digits : 'export';
  return `${EXPORT_FILE_PREFIX}-${exportFileSlug(personName)}-${stamp}.pdf`;
}
