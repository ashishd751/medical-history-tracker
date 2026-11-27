/**
 * The startup sweeper (ADR-034).
 *
 * Files can outlive their rows: a save that moved files and then failed, a delete whose file
 * removal was interrupted, a draft discarded while its staging folder stayed behind. The sweeper
 * runs after migrations, in the background, and reconciles the two:
 *
 * - a file under `attachments/` or `thumbs/` with no row is deleted;
 * - a staging folder that no stored draft references is deleted;
 * - inside the live draft's staging folder, only the files the draft names survive;
 * - **a row whose file is missing is kept.** Deleting rows would silently lose data the user
 *   believes is recorded; the UI shows "File missing" instead, and the row can still be removed
 *   deliberately.
 *
 * It never throws: a failure leaves the store as it was and is logged.
 */
import { ATTACHMENTS_DIR, isRelativeStoredPath, STAGING_DIR, THUMBS_DIR } from '../domain';
import { logger } from '../lib/logger';
import type { FileStore } from './fileStore';
import type { AttachmentRepository } from './repositories/attachmentRepository';
import type { SettingsRepository } from './repositories/settingsRepository';

export interface SweepSummary {
  readonly deletedFiles: number;
  readonly deletedDirs: number;
  /** Rows whose file or thumbnail is absent. Reported, never deleted. */
  readonly rowsWithMissingFiles: number;
}

export interface SweepDependencies {
  readonly files: FileStore;
  readonly attachments: Pick<AttachmentRepository, 'listAll'>;
  readonly settings: Pick<SettingsRepository, 'getRecordDraft'>;
}

interface DraftStaging {
  readonly draftId: string | null;
  readonly paths: readonly string[];
}

function isSafeId(value: string): boolean {
  return value.length > 0 && value.length <= 128 && !value.includes('/') && !value.includes('..');
}

/**
 * The subset of the draft this module needs: which staging folder is live, and which files inside
 * it are still referenced.
 *
 * It is deliberately a *weaker* parser than the form's `parseDraft`: an unreadable draft protects
 * nothing, but nothing beyond what is already unreachable is lost, and a draft the form would
 * ignore cannot make the sweeper delete files the user might still restore.
 */
export function readDraftStaging(raw: string | null): DraftStaging {
  if (!raw) return { draftId: null, paths: [] };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { draftId: null, paths: [] };
    const draft = parsed as { draftId?: unknown; attachments?: unknown };
    const draftId =
      typeof draft.draftId === 'string' && isSafeId(draft.draftId) ? draft.draftId : null;
    if (!draftId || !Array.isArray(draft.attachments)) return { draftId, paths: [] };

    const paths: string[] = [];
    for (const candidate of draft.attachments) {
      if (typeof candidate !== 'object' || candidate === null) continue;
      const entry = candidate as { stagedRelPath?: unknown; stagedThumbRelPath?: unknown };
      for (const path of [entry.stagedRelPath, entry.stagedThumbRelPath]) {
        if (
          typeof path === 'string' &&
          isRelativeStoredPath(path) &&
          path.startsWith(`${STAGING_DIR}/${draftId}/`)
        ) {
          paths.push(path);
        }
      }
    }
    return { draftId, paths };
  } catch {
    return { draftId: null, paths: [] };
  }
}

export async function sweepAttachmentFiles({
  files,
  attachments,
  settings,
}: SweepDependencies): Promise<SweepSummary> {
  const rows = attachments.listAll();

  const referenced = new Set<string>();
  let rowsWithMissingFiles = 0;
  for (const row of rows) {
    referenced.add(row.relPath);
    if (row.thumbRelPath) referenced.add(row.thumbRelPath);
    const missing =
      !files.exists(row.relPath) || (row.thumbRelPath !== null && !files.exists(row.thumbRelPath));
    if (missing) rowsWithMissingFiles += 1;
  }

  const draft = readDraftStaging(settings.getRecordDraft());
  const protectedStaging = new Set(draft.paths);

  let deletedFiles = 0;
  let deletedDirs = 0;

  const remove = async (relPath: string): Promise<void> => {
    await files.remove(relPath);
    deletedFiles += 1;
  };
  const removeDir = async (relDirPath: string): Promise<void> => {
    await files.removeDir(relDirPath);
    deletedDirs += 1;
  };

  try {
    // 1. Stored attachments and thumbnails: keep exactly the referenced ones.
    for (const dir of [ATTACHMENTS_DIR, THUMBS_DIR]) {
      for (const entry of files.listFiles(dir)) {
        if (!referenced.has(entry.relPath)) await remove(entry.relPath);
      }
    }

    // 2. Record folders that no longer hold a file.
    for (const personId of files.listDirs(ATTACHMENTS_DIR)) {
      const personDir = `${ATTACHMENTS_DIR}/${personId}`;
      for (const recordId of files.listDirs(personDir)) {
        const recordDir = `${personDir}/${recordId}`;
        if (files.listFiles(recordDir).length === 0) await removeDir(recordDir);
      }
      if (files.listDirs(personDir).length === 0 && files.listFiles(personDir).length === 0) {
        await removeDir(personDir);
      }
    }

    // 3. Staging: a dead draft's folder goes, and the live draft keeps only what it names.
    for (const draftId of files.listDirs(STAGING_DIR)) {
      const stagingDir = `${STAGING_DIR}/${draftId}`;
      if (draftId !== draft.draftId) {
        await removeDir(stagingDir);
        continue;
      }
      for (const entry of files.listFiles(stagingDir)) {
        if (!protectedStaging.has(entry.relPath)) await remove(entry.relPath);
      }
      const thumbsDir = `${stagingDir}/${THUMBS_DIR}`;
      if (files.listFiles(thumbsDir).length === 0) await removeDir(thumbsDir);
      if (files.listFiles(stagingDir).length === 0) await removeDir(stagingDir);
    }
  } catch (error) {
    // Leave everything else in place: the next launch retries.
    logger.warn('The attachment sweeper stopped early', { error: String(error) });
  }

  if (rowsWithMissingFiles > 0) {
    logger.warn('Attachments whose file is missing were kept', { rows: rowsWithMissingFiles });
  }

  return { deletedFiles, deletedDirs, rowsWithMissingFiles };
}
