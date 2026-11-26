/**
 * The one door to the file system (ADR-030).
 *
 * Everything the app stores lives under the documents directory as a **relative** path, and this
 * module is the only code that turns such a path into a real URI. The SQLite rows keep the relative
 * form, so a backup restored into a different container still resolves.
 *
 * The native operations sit behind `FileSystemPort` so tests can use an in-memory fake; every
 * failure is returned as a `Result`, never thrown at the caller. File I/O is asynchronous here
 * because `File.move`, `File.copy` and `File.digest` are asynchronous in the SDK 58 API — the
 * repositories stay synchronous (ADR-020), files do not.
 */
import { Directory, File, Paths } from 'expo-file-system';

import { type AppError, appError } from '../lib/errors';
import { logger } from '../lib/logger';
import { err, ok, type Result } from '../lib/result';

export interface FileEntry {
  /** Relative to the documents directory. */
  readonly relPath: string;
  readonly bytes: number;
}

export interface ImportedFile extends FileEntry {
  readonly sha256: string;
}

/** The native surface the store needs. Implemented once for Expo, once in memory for tests. */
export interface FileSystemPort {
  readonly documentsUri: string;
  exists(relPath: string): boolean;
  /** Size in bytes; 0 when the file is missing or unreadable. */
  bytes(relPath: string): number;
  ensureDir(relDirPath: string): void;
  /** Copies an absolute `file://` source into the store, creating parent directories. */
  copyIn(sourceUri: string, relPath: string): Promise<void>;
  writeText(relPath: string, text: string): void;
  move(fromRelPath: string, toRelPath: string): Promise<void>;
  remove(relPath: string): void;
  removeDir(relDirPath: string): void;
  /** Every file below the directory, recursively, sorted by path. Empty when it does not exist. */
  listFiles(relDirPath: string): FileEntry[];
  /** Immediate child directory names, sorted. Empty when it does not exist. */
  listDirs(relDirPath: string): string[];
  /** Lower-case hex SHA-256 of the file's bytes. */
  hash(relPath: string): Promise<string>;
}

export interface FileStore {
  readonly documentsUri: string;
  /** Absolute URI for a stored relative path. Only the share sheet and image views need this. */
  toUri(relPath: string): string;
  exists(relPath: string): boolean;
  bytes(relPath: string): number;
  ensureDir(relDirPath: string): Result<true, AppError>;
  /** Copies a picked file in, then reports its size and checksum. */
  importFile(sourceUri: string, relPath: string): Promise<Result<ImportedFile, AppError>>;
  writeText(relPath: string, text: string): Result<true, AppError>;
  move(fromRelPath: string, toRelPath: string): Promise<Result<true, AppError>>;
  remove(relPath: string): Promise<Result<true, AppError>>;
  /** Best effort: called after a commit, so a failure must not undo the database. */
  removeMany(relPaths: readonly string[]): Promise<void>;
  removeDir(relDirPath: string): Promise<void>;
  listFiles(relDirPath: string): FileEntry[];
  listDirs(relDirPath: string): string[];
  hash(relPath: string): Promise<Result<string, AppError>>;
}

function parentOf(relPath: string): string {
  const slash = relPath.lastIndexOf('/');
  return slash <= 0 ? '' : relPath.slice(0, slash);
}

export function createFileStore(port: FileSystemPort): FileStore {
  const uriFor = (relPath: string): string =>
    `${port.documentsUri.replace(/\/$/, '')}/${relPath.replace(/^\//, '')}`;

  return {
    documentsUri: port.documentsUri,

    toUri: uriFor,

    exists: (relPath) => port.exists(relPath),

    bytes: (relPath) => port.bytes(relPath),

    ensureDir(relDirPath) {
      if (!relDirPath) return ok(true);
      try {
        port.ensureDir(relDirPath);
        return ok(true);
      } catch (error) {
        return err(appError('FILE_WRITE_FAILED', `Could not create ${relDirPath}.`, error));
      }
    },

    async importFile(sourceUri, relPath) {
      try {
        const parent = parentOf(relPath);
        if (parent) port.ensureDir(parent);
        await port.copyIn(sourceUri, relPath);
        const bytes = port.bytes(relPath);
        if (bytes <= 0) {
          // A copy that leaves an empty file is a failed copy, not a zero-byte attachment.
          port.remove(relPath);
          return err(appError('FILE_WRITE_FAILED', `Copying ${relPath} produced no bytes.`));
        }
        const sha256 = await port.hash(relPath);
        return ok({ relPath, bytes, sha256 });
      } catch (error) {
        return err(appError('FILE_WRITE_FAILED', `Could not write ${relPath}.`, error));
      }
    },

    writeText(relPath, text) {
      try {
        const parent = parentOf(relPath);
        if (parent) port.ensureDir(parent);
        port.writeText(relPath, text);
        return ok(true);
      } catch (error) {
        return err(appError('FILE_WRITE_FAILED', `Could not write ${relPath}.`, error));
      }
    },

    async move(fromRelPath, toRelPath) {
      try {
        const parent = parentOf(toRelPath);
        if (parent) port.ensureDir(parent);
        await port.move(fromRelPath, toRelPath);
        return ok(true);
      } catch (error) {
        return err(appError('FILE_WRITE_FAILED', `Could not move ${fromRelPath}.`, error));
      }
    },

    async remove(relPath) {
      try {
        port.remove(relPath);
        return ok(true);
      } catch (error) {
        return err(appError('FILE_WRITE_FAILED', `Could not delete ${relPath}.`, error));
      }
    },

    async removeMany(relPaths) {
      for (const relPath of relPaths) {
        try {
          port.remove(relPath);
        } catch (error) {
          // The sweeper retries on the next launch; a missing file is already the desired state.
          logger.warn('Could not delete an attachment file', { relPath, error: String(error) });
        }
      }
    },

    async removeDir(relDirPath) {
      try {
        port.removeDir(relDirPath);
      } catch (error) {
        logger.warn('Could not delete a directory', { relDirPath, error: String(error) });
      }
    },

    listFiles: (relDirPath) => port.listFiles(relDirPath),

    listDirs: (relDirPath) => port.listDirs(relDirPath),

    async hash(relPath) {
      try {
        return ok(await port.hash(relPath));
      } catch (error) {
        return err(appError('FILE_NOT_FOUND', `Could not read ${relPath}.`, error));
      }
    },
  };
}

/** The Expo implementation of the port. Constructed lazily so tests never touch `Paths`. */
export function createExpoFileSystemPort(): FileSystemPort {
  const documentsUri = Paths.document.uri;
  const base = documentsUri.replace(/\/$/, '');
  const fileFor = (relPath: string) => new File(`${base}/${relPath}`);
  const dirFor = (relDirPath: string) => new Directory(`${base}/${relDirPath}`);
  const relative = (uri: string): string =>
    decodeURIComponent(uri.startsWith(`${base}/`) ? uri.slice(base.length + 1) : uri);

  return {
    documentsUri,

    exists: (relPath) => fileFor(relPath).exists,

    bytes: (relPath) => {
      const file = fileFor(relPath);
      return file.exists ? file.size : 0;
    },

    ensureDir(relDirPath) {
      dirFor(relDirPath).create({ intermediates: true, idempotent: true });
    },

    async copyIn(sourceUri, relPath) {
      const destination = fileFor(relPath);
      // The source is a file:// URI from a picker (the document picker copies into the cache first).
      await new File(sourceUri).copy(destination, { overwrite: true });
    },

    writeText(relPath, text) {
      const file = fileFor(relPath);
      if (!file.exists) file.create();
      file.writeSync(text);
    },

    async move(fromRelPath, toRelPath) {
      await fileFor(fromRelPath).move(fileFor(toRelPath), { overwrite: true });
    },

    remove(relPath) {
      const file = fileFor(relPath);
      if (file.exists) file.delete();
    },

    removeDir(relDirPath) {
      const dir = dirFor(relDirPath);
      if (dir.exists) dir.delete();
    },

    listFiles(relDirPath) {
      const root = dirFor(relDirPath);
      if (!root.exists) return [];
      const found: FileEntry[] = [];
      const walk = (dir: Directory): void => {
        for (const entry of dir.list()) {
          if (entry instanceof Directory) {
            walk(entry);
          } else {
            found.push({ relPath: relative(entry.uri), bytes: entry.size });
          }
        }
      };
      walk(root);
      return found.sort((a, b) => a.relPath.localeCompare(b.relPath));
    },

    listDirs(relDirPath) {
      const root = dirFor(relDirPath);
      if (!root.exists) return [];
      return root
        .list()
        .filter((entry): entry is Directory => entry instanceof Directory)
        .map((entry) => entry.name)
        .sort();
    },

    hash: (relPath) => fileFor(relPath).digest('SHA-256'),
  };
}

let cached: FileStore | null = null;

/** The app's store. Lazy so a unit test that imports `data` does not need a native file system. */
export function getFileStore(): FileStore {
  cached ??= createFileStore(createExpoFileSystemPort());
  return cached;
}
