/**
 * The app's startup sweep: repositories + the real file store, run once after launch.
 *
 * Separate from `fileSweeper.ts` so that module stays a pure function of its dependencies and can
 * be tested with an in-memory file system.
 */
import { getFileStore } from './fileStore';
import { sweepAttachmentFiles, type SweepSummary } from './fileSweeper';
import { getRepositories } from './repositories';

export async function sweepAttachmentsAtStartup(): Promise<SweepSummary | null> {
  const repositories = getRepositories();
  if (!repositories.ok) return null;
  return sweepAttachmentFiles({
    files: getFileStore(),
    attachments: repositories.value.attachments,
    settings: repositories.value.settings,
  });
}
