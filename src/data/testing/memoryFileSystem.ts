/**
 * An in-memory `FileSystemPort` for tests (ADR-030). Test-only; never bundled into the app.
 *
 * It records what was written where, computes a real SHA-256 with Node's crypto (the same digest
 * the native port returns), and keeps "external" source files separate so `copyIn` behaves like a
 * picker hand-off rather than a no-op.
 */
import { createHash } from 'node:crypto';

import type { FileEntry, FileSystemPort } from '../fileStore';

export const MEMORY_DOCUMENTS_URI = 'file:///memory/Documents';

export interface MemoryFileSystem extends FileSystemPort {
  /** A file that already exists in the store, e.g. written by an earlier session. */
  seed(relPath: string, contents?: string | Uint8Array): void;
  /** A file outside the store, used as the `sourceUri` of `copyIn`. */
  seedSource(uri: string, contents?: string | Uint8Array): void;
  contents(relPath: string): Uint8Array | null;
  /** Every stored path, sorted. */
  paths(): string[];
}

function toBytes(contents: string | Uint8Array | undefined): Uint8Array {
  if (contents === undefined) return new Uint8Array([1, 2, 3]);
  return typeof contents === 'string' ? new TextEncoder().encode(contents) : contents;
}

export function createMemoryFileSystem(seed: Record<string, string> = {}): MemoryFileSystem {
  const files = new Map<string, Uint8Array>();
  const sources = new Map<string, Uint8Array>();
  for (const [path, contents] of Object.entries(seed)) files.set(path, toBytes(contents));

  const under = (prefix: string): string[] =>
    [...files.keys()].filter((path) => path === prefix || path.startsWith(`${prefix}/`));

  const port: MemoryFileSystem = {
    documentsUri: MEMORY_DOCUMENTS_URI,

    exists: (relPath) => files.has(relPath),

    bytes: (relPath) => files.get(relPath)?.length ?? 0,

    ensureDir: () => undefined,

    async copyIn(sourceUri, relPath) {
      const source = sources.get(sourceUri);
      if (!source) throw new Error(`No such source file: ${sourceUri}`);
      files.set(relPath, source.slice());
    },

    writeText(relPath, text) {
      files.set(relPath, toBytes(text));
    },

    async move(fromRelPath, toRelPath) {
      const source = files.get(fromRelPath);
      if (!source) throw new Error(`No such file: ${fromRelPath}`);
      files.set(toRelPath, source);
      files.delete(fromRelPath);
    },

    remove(relPath) {
      if (!files.delete(relPath)) throw new Error(`No such file: ${relPath}`);
    },

    removeDir(relDirPath) {
      for (const path of under(relDirPath)) files.delete(path);
    },

    listFiles(relDirPath): FileEntry[] {
      return under(relDirPath)
        .filter((path) => path !== relDirPath)
        .sort()
        .map((path) => ({ relPath: path, bytes: files.get(path)?.length ?? 0 }));
    },

    listDirs(relDirPath): string[] {
      const names = new Set<string>();
      for (const path of under(relDirPath)) {
        const rest = path.slice(relDirPath.length + 1);
        const slash = rest.indexOf('/');
        if (slash > 0) names.add(rest.slice(0, slash));
      }
      return [...names].sort();
    },

    async hash(relPath) {
      const contents = files.get(relPath);
      if (!contents) throw new Error(`No such file: ${relPath}`);
      return createHash('sha256').update(contents).digest('hex');
    },

    seed(relPath, contents) {
      files.set(relPath, toBytes(contents));
    },

    seedSource(uri, contents) {
      sources.set(uri, toBytes(contents));
    },

    contents: (relPath) => files.get(relPath)?.slice() ?? null,

    paths: () => [...files.keys()].sort(),
  };

  return port;
}
