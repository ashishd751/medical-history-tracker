/**
 * Removing earlier PDF exports at launch (Phase 4).
 *
 * A PDF of a family's medical history must not sit in the cache after the session that produced
 * it: it is a copy the user may have shared and forgotten, and `docs/PRIVACY.md` promises it does
 * not linger. The export service also clears before writing a new file; this launch-time pass
 * covers the case where the user never exports again (ADR-049).
 *
 * It lives in `shell` rather than in the export feature because it is a bootstrap task: features
 * must not import each other's internals, and this is the module `AppProviders` already owns.
 *
 * Never throws: a file that cannot be removed now is retried at the next launch, and a failure must
 * not stop the app from opening.
 */
import { logger } from '@/lib/logger';
import type { ExportFiles } from '@/platform';

export interface ExportCleanupDeps {
  readonly files: ExportFiles;
}

export async function clearPreviousExportsAtStartup(deps: ExportCleanupDeps): Promise<number> {
  try {
    const removed = await deps.files.clearPrevious();
    if (removed > 0) logger.info('Removed earlier PDF exports', { files: removed });
    return removed;
  } catch (error) {
    logger.warn('The export cleanup failed', { error: String(error) });
    return 0;
  }
}
