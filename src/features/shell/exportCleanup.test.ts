import { createFakeExportFiles } from '@/platform/testing/fakes';

import { clearPreviousExportsAtStartup } from './exportCleanup';

describe('clearPreviousExportsAtStartup', () => {
  it('removes every earlier export and reports how many', async () => {
    const files = createFakeExportFiles(['old-1.pdf', 'old-2.pdf']);
    const removed = await clearPreviousExportsAtStartup({ files });

    expect(removed).toBe(2);
    expect(files.files).toEqual([]);
    expect(files.cleared).toBe(2);
  });

  it('does nothing on a first launch', async () => {
    const files = createFakeExportFiles();
    await expect(clearPreviousExportsAtStartup({ files })).resolves.toBe(0);
  });

  it('never throws when the file system refuses', async () => {
    const files = createFakeExportFiles(['old.pdf']);
    const failing = {
      ...files,
      async clearPrevious(): Promise<number> {
        throw new Error('cache unavailable');
      },
    };
    await expect(clearPreviousExportsAtStartup({ files: failing })).resolves.toBe(0);
  });
});
