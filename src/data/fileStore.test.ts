/**
 * @jest-environment node
 */
import { createFileStore } from './fileStore';
import { createMemoryFileSystem, MEMORY_DOCUMENTS_URI } from './testing/memoryFileSystem';

function storeWith(seed: Record<string, string> = {}) {
  const port = createMemoryFileSystem(seed);
  return { port, store: createFileStore(port) };
}

describe('fileStore', () => {
  it('copies a picked file in and reports its size and checksum', async () => {
    const { port, store } = storeWith();
    port.seedSource('file:///cache/picked.jpg', 'synthetic-image-bytes');

    const imported = await store.importFile('file:///cache/picked.jpg', 'attachments/p1/r1/a1.jpg');

    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value.bytes).toBe('synthetic-image-bytes'.length);
    // A real SHA-256, so a repository test can compare it with the row it writes.
    expect(imported.value.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(store.exists('attachments/p1/r1/a1.jpg')).toBe(true);
  });

  it('refuses a copy that leaves no bytes and removes the empty file', async () => {
    const { port, store } = storeWith();
    port.seedSource('file:///cache/empty.jpg', new Uint8Array());

    const imported = await store.importFile('file:///cache/empty.jpg', 'staging/d1/a1.jpg');

    expect(imported.ok).toBe(false);
    if (imported.ok) return;
    expect(imported.error.code).toBe('FILE_WRITE_FAILED');
    expect(store.exists('staging/d1/a1.jpg')).toBe(false);
  });

  it('reports a missing source instead of throwing', async () => {
    const { store } = storeWith();

    const imported = await store.importFile('file:///cache/gone.jpg', 'staging/d1/a1.jpg');

    expect(imported.ok).toBe(false);
  });

  it('moves a staged file into its final directory', async () => {
    const { store } = storeWith({ 'staging/d1/a1.jpg': 'staged' });

    const moved = await store.move('staging/d1/a1.jpg', 'attachments/p1/r1/a1.jpg');

    expect(moved.ok).toBe(true);
    expect(store.exists('staging/d1/a1.jpg')).toBe(false);
    expect(store.exists('attachments/p1/r1/a1.jpg')).toBe(true);
    expect(store.bytes('attachments/p1/r1/a1.jpg')).toBe(6);
  });

  it('turns a stored relative path into a URI under the documents directory', () => {
    const { store } = storeWith();

    expect(store.toUri('thumbs/a1.jpg')).toBe(`${MEMORY_DOCUMENTS_URI}/thumbs/a1.jpg`);
  });

  it('lists files recursively and directories one level at a time', () => {
    const { store } = storeWith({
      'attachments/p1/r1/a1.jpg': 'a',
      'attachments/p1/r2/a2.pdf': 'bb',
      'thumbs/a1.jpg': 'c',
    });

    expect(store.listFiles('attachments').map((entry) => entry.relPath)).toEqual([
      'attachments/p1/r1/a1.jpg',
      'attachments/p1/r2/a2.pdf',
    ]);
    expect(store.listDirs('attachments')).toEqual(['p1']);
    expect(store.listDirs('missing')).toEqual([]);
    expect(store.listFiles('missing')).toEqual([]);
  });

  it('hashes a stored file and reports a missing one', async () => {
    const { store } = storeWith({ 'thumbs/a1.jpg': 'abc' });

    const hashed = await store.hash('thumbs/a1.jpg');
    expect(hashed.ok && hashed.value).toMatch(/^[0-9a-f]{64}$/);

    const missing = await store.hash('thumbs/nope.jpg');
    expect(missing.ok).toBe(false);
  });

  it('deletes many files without failing the batch when one is already gone', async () => {
    const { store } = storeWith({ 'thumbs/a1.jpg': 'a' });

    await store.removeMany(['thumbs/a1.jpg', 'thumbs/gone.jpg']);

    expect(store.exists('thumbs/a1.jpg')).toBe(false);
  });

  it('removes a directory with everything under it', async () => {
    const { store } = storeWith({
      'staging/d1/a1.jpg': 'a',
      'staging/d1/thumbs/a1.jpg': 'b',
      'staging/d2/a2.jpg': 'c',
    });

    await store.removeDir('staging/d1');

    expect(store.listFiles('staging/d1')).toEqual([]);
    expect(store.exists('staging/d2/a2.jpg')).toBe(true);
  });
});
