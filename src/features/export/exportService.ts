/**
 * Generating and sharing the PDF (Phase 4).
 *
 * The service owns the sequence and nothing else: read the rows, assemble the document, print it,
 * give the file a usable name, hand it to the share sheet. Everything device-facing is injected
 * (`PdfPrinter`, `ExportFiles`, `FileSharer`), so the whole flow is testable with fakes and the
 * screen only has to render state (ADR-047).
 *
 * The old exports are cleared **before** printing, never after: clearing after `adopt` would
 * delete the very file that is about to be shared, and a failed print should still leave no stale
 * PDF of a family's medical history in the cache.
 */
import type { AppRepositories } from '@/data';
import {
  buildExportFileName,
  buildExportHtml,
  type ExportColumnId,
  type ExportSortOrder,
  normalizeExportColumns,
  pageSizeFor,
  type RecordKind,
  sortExportRecords,
} from '@/domain';
import { formatDisplayDate } from '@/lib/dates';
import { type AppError, appError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { err, ok, type Result } from '@/lib/result';
import type { ExportFiles, FileSharer, PdfPrinter } from '@/platform';
import { exportColumnLabel, strings } from '@/ui';

import { buildExportFacts, buildExportRows, formatExportRange } from './exportFormat';

export interface ExportFilterInput {
  /** Inclusive `YYYY-MM-DD`. */
  readonly from?: string;
  /** Inclusive `YYYY-MM-DD`. */
  readonly to?: string;
  readonly kinds?: readonly RecordKind[];
}

export interface ExportRequest {
  readonly personId: string;
  readonly filter: ExportFilterInput;
  readonly columns: readonly ExportColumnId[];
  readonly sortOrder: ExportSortOrder;
  /** The device's local date, `YYYY-MM-DD`. Injected so the file name is testable. */
  readonly today: string;
}

export interface ExportOutcome {
  /** `file://` URI of the adopted file in the cache. */
  readonly uri: string;
  readonly fileName: string;
  readonly pages: number;
  readonly recordCount: number;
  /** Milliseconds from the first read to the share sheet being presented. */
  readonly elapsedMs: number;
  /** False when the platform has no share sheet; the file still exists. */
  readonly shared: boolean;
}

export interface ExportServiceDeps {
  readonly repositories: Pick<AppRepositories, 'exports' | 'people' | 'profile' | 'settings'>;
  readonly printer: PdfPrinter;
  readonly files: ExportFiles;
  readonly sharer: FileSharer;
  /** Injected clock; defaults to `Date.now`. */
  readonly now?: () => number;
}

/**
 * Builds the PDF and opens the share sheet.
 *
 * A friendly `AppError` is returned for every expected failure (no rows, print failure, a file
 * that cannot be moved); the screen shows `userMessage(error)` and nothing else.
 */
export async function generateAndShareExport(
  deps: ExportServiceDeps,
  request: ExportRequest,
): Promise<Result<ExportOutcome, AppError>> {
  const now = deps.now ?? Date.now;
  const started = now();

  try {
    const person = deps.repositories.people.getById(request.personId);
    if (!person) {
      return err(appError('EXPORT_FAILED', `No person ${request.personId} to export.`));
    }

    const columns = normalizeExportColumns(request.columns);
    const records = deps.repositories.exports.load(request.personId, request.filter);
    if (records.length === 0) {
      return err(appError('VALIDATION_FAILED', 'No records match the export filters.'));
    }

    const settings = deps.repositories.settings.getSettings();
    const snapshot = deps.repositories.profile.snapshot(request.personId, {
      today: request.today,
      bmiPreset: settings.bmiPreset,
    });
    if (!snapshot) {
      return err(appError('EXPORT_FAILED', `No profile for person ${request.personId}.`));
    }

    const ordered = sortExportRecords(records, request.sortOrder);
    const rows = buildExportRows(ordered, columns, { unitSystem: settings.unitSystem });
    const html = buildExportHtml({
      documentTitle: strings.export.documentTitle,
      personName: person.name,
      facts: buildExportFacts({
        snapshot,
        today: request.today,
        dob: person.dob,
        unitSystem: settings.unitSystem,
      }),
      summary: strings.export.summary(
        ordered.length,
        formatExportRange(request.filter.from, request.filter.to),
      ),
      exportedOn: strings.export.exportedOn(formatDisplayDate(request.today)),
      columns: columns.map((id) => ({ id, label: exportColumnLabel(id) })),
      rows,
      emptyMessage: strings.export.emptyDocument,
      disclaimer: strings.app.disclaimer,
    });

    const page = pageSizeFor(columns.length);

    // A stale PDF from an earlier export must not outlive this one (ADR-049).
    await deps.files.clearPrevious();

    const printed = await deps.printer.print({
      html,
      width: page.width,
      height: page.height,
    });

    const fileName = buildExportFileName(person.name, request.today);
    const uri = await deps.files.adopt(printed.uri, fileName);
    const shared = await deps.sharer.share(uri, {
      mimeType: 'application/pdf',
      title: fileName,
    });

    return ok({
      uri,
      fileName,
      pages: printed.numberOfPages,
      recordCount: ordered.length,
      elapsedMs: now() - started,
      shared: shared === 'shared',
    });
  } catch (error) {
    logger.warn('The PDF export failed', { error: String(error) });
    return err(appError('EXPORT_FAILED', 'The PDF export failed.', error));
  }
}
