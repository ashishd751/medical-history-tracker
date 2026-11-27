import { requireRepositories } from '@/data';
import { expoExportFiles, expoFileSharer, expoPdfPrinter } from '@/platform';

import type { ExportServiceDeps } from './exportService';

/**
 * The real dependencies for the export service.
 *
 * A separate module so the screen stays a screen and a test can build the service with fakes
 * instead (the same pattern as `attachmentDeps.ts`).
 */
export function createExportDeps(): ExportServiceDeps {
  return {
    repositories: requireRepositories(),
    printer: expoPdfPrinter,
    files: expoExportFiles,
    sharer: expoFileSharer,
  };
}
