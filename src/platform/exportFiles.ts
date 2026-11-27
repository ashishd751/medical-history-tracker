/**
 * Where an exported PDF lives (Phase 4).
 *
 * `printToFileAsync` writes into the cache under a generated name. Two things must happen before
 * the file is handed to the share sheet, and both belong here rather than in a feature, because
 * this is the only module that touches the file system for an export (ADR-048):
 *
 * 1. adopt — move the temp file to `cache/exports/medical-history-<name>-<date>.pdf`;
 * 2. clear — delete every earlier export, because a PDF of a family's medical history must not sit
 *    in the cache indefinitely. It runs at launch and again before a new export.
 *
 * The cache (not the documents directory) is deliberate: the OS may reclaim it, `docs/PRIVACY.md`
 * says so, and nothing here is a source of truth.
 */
import { Directory, File, Paths } from 'expo-file-system';

/** The folder inside the cache directory that holds adopted exports. */
export const EXPORTS_DIR = 'exports';

export interface ExportFiles {
  /** Moves the printer's temporary file to `fileName` and returns its `file://` URI. */
  adopt(tempUri: string, fileName: string): Promise<string>;
  /** Deletes earlier exports; returns how many files were removed. Never throws. */
  clearPrevious(): Promise<number>;
}

function exportsDirectory(): Directory {
  return new Directory(Paths.cache, EXPORTS_DIR);
}

export const expoExportFiles: ExportFiles = {
  async adopt(tempUri, fileName) {
    const directory = exportsDirectory();
    directory.create({ idempotent: true, intermediates: true });
    const target = new File(directory, fileName);
    if (target.exists) target.delete();
    await new File(tempUri).move(target, { overwrite: true });
    return target.uri;
  },

  async clearPrevious() {
    const directory = exportsDirectory();
    if (!directory.exists) return 0;
    let removed = 0;
    for (const entry of directory.list()) {
      if (!(entry instanceof File)) continue;
      try {
        entry.delete();
        removed += 1;
      } catch {
        // Best effort: a file that cannot be deleted now is retried at the next launch.
      }
    }
    return removed;
  },
};
