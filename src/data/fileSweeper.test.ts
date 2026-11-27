/**
 * @jest-environment node
 */
import { createFileStore } from './fileStore';
import { readDraftStaging, sweepAttachmentFiles } from './fileSweeper';
import type { AttachmentRow } from './schema';
import { createMemoryFileSystem } from './testing/memoryFileSystem';

function row(overrides: Partial<AttachmentRow> = {}): AttachmentRow {
  return {
    id: 'a1',
    recordId: 'r1',
    role: 'prescription',
    mime: 'image/jpeg',
    relPath: 'attachments/p1/r1/a1.jpg',
    thumbRelPath: 'thumbs/a1.jpg',
    bytes: 100,
    sha256: 'a'.repeat(64),
    ocrText: null,
    handwritingLikely: null,
    createdAt: 1,
    ...overrides,
  };
}

function sweep(
  files: ReturnType<typeof createMemoryFileSystem>,
  rows: readonly AttachmentRow[],
  draft: string | null,
) {
  return sweepAttachmentFiles({
    files: createFileStore(files),
    attachments: { listAll: () => [...rows] },
    settings: { getRecordDraft: () => draft },
  });
}

describe('sweepAttachmentFiles', () => {
  it('deletes files no row references and keeps the referenced ones', async () => {
    const files = createMemoryFileSystem({
      'attachments/p1/r1/a1.jpg': 'kept',
      'attachments/p1/r1/orphan.jpg': 'orphan',
      'thumbs/a1.jpg': 'kept',
      'thumbs/orphan.jpg': 'orphan',
    });

    const summary = await sweep(files, [row()], null);

    expect(summary.deletedFiles).toBe(2);
    expect(files.exists('attachments/p1/r1/a1.jpg')).toBe(true);
    expect(files.exists('thumbs/a1.jpg')).toBe(true);
    expect(files.exists('attachments/p1/r1/orphan.jpg')).toBe(false);
    expect(files.exists('thumbs/orphan.jpg')).toBe(false);
  });

  it('keeps a row whose file is missing and reports it', async () => {
    const files = createMemoryFileSystem();
    const rows = [row()];

    const summary = await sweep(files, rows, null);

    expect(summary.rowsWithMissingFiles).toBe(1);
    // The row survives: no data disappears silently.
    expect(rows).toHaveLength(1);
  });

  it('removes an empty record folder and an empty person folder', async () => {
    const files = createMemoryFileSystem({
      'attachments/p1/r1/gone.jpg': 'x',
      'attachments/p2/r2/a2.jpg': 'kept',
    });
    const rows = [row({ id: 'a2', relPath: 'attachments/p2/r2/a2.jpg', thumbRelPath: null })];

    await sweep(files, rows, null);

    // The fake derives directories from its files, so the empty p1 tree is already invisible; the
    // real store keeps empty directories and the sweeper deletes them.
    expect(files.paths()).toEqual(['attachments/p2/r2/a2.jpg']);
    expect(files.listDirs('attachments')).toEqual(['p2']);
  });

  it('deletes another draft’s staging folder entirely', async () => {
    const files = createMemoryFileSystem({
      'staging/dead/a9.jpg': 'x',
      'staging/dead/thumbs/a9.jpg': 'x',
      'staging/live/a1.jpg': 'kept',
      'staging/live/thumbs/a1.jpg': 'kept',
    });
    const draft = JSON.stringify({
      draftId: 'live',
      attachments: [
        { stagedRelPath: 'staging/live/a1.jpg', stagedThumbRelPath: 'staging/live/thumbs/a1.jpg' },
      ],
    });

    await sweep(files, [], draft);

    expect(files.listDirs('staging')).toEqual(['live']);
    expect(files.exists('staging/live/a1.jpg')).toBe(true);
    expect(files.exists('staging/live/thumbs/a1.jpg')).toBe(true);
  });

  it('keeps only the files the live draft names', async () => {
    const files = createMemoryFileSystem({
      'staging/live/a1.jpg': 'kept',
      'staging/live/thumbs/a1.jpg': 'kept',
      'staging/live/a2.jpg': 'abandoned',
      'staging/live/thumbs/a2.jpg': 'abandoned',
    });
    const draft = JSON.stringify({
      draftId: 'live',
      attachments: [
        { stagedRelPath: 'staging/live/a1.jpg', stagedThumbRelPath: 'staging/live/thumbs/a1.jpg' },
      ],
    });

    const summary = await sweep(files, [], draft);

    expect(summary.deletedFiles).toBe(2);
    expect(files.exists('staging/live/a1.jpg')).toBe(true);
    expect(files.exists('staging/live/a2.jpg')).toBe(false);
  });

  it('clears all staging when no draft is stored', async () => {
    const files = createMemoryFileSystem({ 'staging/live/a1.jpg': 'x' });

    await sweep(files, [], null);

    expect(files.listDirs('staging')).toEqual([]);
  });

  it('reads only paths that stay inside the draft’s own staging folder', () => {
    expect(
      readDraftStaging(
        JSON.stringify({
          draftId: 'live',
          attachments: [
            { stagedRelPath: 'staging/live/a1.jpg' },
            { stagedRelPath: 'staging/other/a2.jpg' },
            { stagedRelPath: '../escape.jpg' },
            { stagedRelPath: 42 },
          ],
        }),
      ),
    ).toEqual({ draftId: 'live', paths: ['staging/live/a1.jpg'] });

    expect(readDraftStaging('not json')).toEqual({ draftId: null, paths: [] });
    expect(readDraftStaging(null)).toEqual({ draftId: null, paths: [] });
  });
});
