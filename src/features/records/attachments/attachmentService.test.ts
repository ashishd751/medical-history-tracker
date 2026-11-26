/**
 * @jest-environment node
 */
import { createFileStore } from '@/data/fileStore';
import { createMemoryFileSystem } from '@/data/testing/memoryFileSystem';
import {
  createFakeDocumentPicker,
  createFakeImageLibraryPicker,
  createFakeImageProcessor,
  createFakePdfThumbnailer,
  pickedFile,
} from '@/platform/testing/fakes';

import { createAttachmentService, type ImportRequest } from './attachmentService';

const REQUEST: ImportRequest = {
  role: 'prescription',
  personId: 'p1',
  draftId: 'd1',
  existingCount: 0,
};

function harness(options: { readonly processorFails?: boolean } = {}) {
  const files = createMemoryFileSystem();
  files.seedSource('file:///picked/photo.jpg', 'jpeg-bytes');
  files.seedSource('file:///picked/scan.png', 'png-bytes');
  files.seedSource('file:///picked/report.pdf', '%PDF-1.4 synthetic');
  // The fake image processor and PDF renderer hand back these cache URIs.
  for (let index = 1; index <= 12; index += 1) {
    files.seedSource(`file:///fake/processed-${index}.jpg`, `processed-${index}`);
    files.seedSource(`file:///fake/page-${index}.jpg`, `page-${index}`);
  }

  const images = createFakeImageLibraryPicker();
  const documents = createFakeDocumentPicker();
  const processor = createFakeImageProcessor({ fail: options.processorFails });
  const pdf = createFakePdfThumbnailer();
  let counter = 0;
  const service = createAttachmentService({
    images,
    documents,
    processor,
    pdf,
    files: createFileStore(files),
    newId: () => `id${(counter += 1)}`,
  });

  return { files, images, documents, processor, pdf, service };
}

describe('attachmentService import', () => {
  it('stages a library photo as a JPEG with a thumbnail and a checksum', async () => {
    const { files, images, processor, service } = harness();
    images.pickImages = async () => ({
      status: 'picked',
      limited: false,
      files: [pickedFile({ uri: 'file:///picked/photo.jpg' })],
    });

    const result = await service.importFromLibrary(REQUEST);

    expect(result.status).toBe('staged');
    if (result.status !== 'staged') return;
    expect(result.problems).toEqual([]);
    expect(result.attachments).toHaveLength(1);
    const attachment = result.attachments[0];
    expect(attachment).toMatchObject({
      id: 'id1',
      role: 'prescription',
      mime: 'image/jpeg',
      stagedRelPath: 'staging/d1/id1.jpg',
      stagedThumbRelPath: 'staging/d1/thumbs/id1.jpg',
    });
    expect(attachment?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(files.exists('staging/d1/id1.jpg')).toBe(true);
    expect(files.exists('staging/d1/thumbs/id1.jpg')).toBe(true);
    // Full image at 2000 px without flattening; the thumbnail is 400 px from the stored JPEG.
    expect(processor.calls[0]).toMatchObject({ maxLongEdge: 2000, flattenTransparency: false });
    expect(processor.calls[1]).toMatchObject({ maxLongEdge: 400, flattenTransparency: false });
  });

  it('flattens a PNG onto white before encoding it', async () => {
    const { images, processor, service } = harness();
    images.pickImages = async () => ({
      status: 'picked',
      limited: false,
      files: [pickedFile({ uri: 'file:///picked/scan.png', name: 'scan.png', mime: 'image/png' })],
    });

    await service.importFromLibrary(REQUEST);

    expect(processor.calls[0]?.flattenTransparency).toBe(true);
  });

  it('keeps a PDF unchanged and renders its first page as the thumbnail', async () => {
    const { files, documents, pdf, service } = harness();
    documents.pickDocuments = async () => ({
      status: 'picked',
      limited: false,
      files: [
        pickedFile({
          uri: 'file:///picked/report.pdf',
          name: 'report.pdf',
          mime: 'application/pdf',
          bytes: 2048,
        }),
      ],
    });

    const result = await service.importFromFiles({ ...REQUEST, role: 'lab_report' });

    expect(result.status).toBe('staged');
    if (result.status !== 'staged') return;
    expect(result.attachments[0]).toMatchObject({
      mime: 'application/pdf',
      role: 'lab_report',
      stagedRelPath: 'staging/d1/id1.pdf',
    });
    expect(files.exists('staging/d1/id1.pdf')).toBe(true);
    expect(pdf.calls).toHaveLength(1);
    expect(pdf.calls[0]?.uri).toBe('file:///memory/Documents/staging/d1/id1.pdf');
    expect(pdf.calls[0]?.maxLongEdge).toBe(400);
  });

  it('rejects an unsupported type without writing anything', async () => {
    const { files, images, service } = harness();
    images.pickImages = async () => ({
      status: 'picked',
      limited: false,
      files: [
        pickedFile({ uri: 'file:///picked/notes.txt', name: 'notes.txt', mime: 'text/plain' }),
      ],
    });

    const result = await service.importFromLibrary(REQUEST);

    expect(result.status).toBe('staged');
    if (result.status !== 'staged') return;
    expect(result.attachments).toEqual([]);
    expect(result.problems[0]?.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    expect(files.paths()).toEqual([]);
  });

  it('rejects a PDF over the size cap before copying it', async () => {
    const { files, documents, service } = harness();
    documents.pickDocuments = async () => ({
      status: 'picked',
      limited: false,
      files: [
        pickedFile({
          uri: 'file:///picked/big.pdf',
          name: 'big.pdf',
          mime: 'application/pdf',
          bytes: 26 * 1024 * 1024,
        }),
      ],
    });

    const result = await service.importFromFiles(REQUEST);

    expect(result.status).toBe('staged');
    if (result.status !== 'staged') return;
    expect(result.problems[0]?.error.code).toBe('FILE_TOO_LARGE');
    expect(files.paths()).toEqual([]);
  });

  it('reports a corrupt image and leaves no file behind', async () => {
    const broken = harness({ processorFails: true });
    broken.images.pickImages = async () => ({
      status: 'picked',
      limited: false,
      files: [pickedFile({ uri: 'file:///picked/photo.jpg' })],
    });

    const result = await broken.service.importFromLibrary(REQUEST);

    expect(result.status).toBe('staged');
    if (result.status !== 'staged') return;
    expect(result.problems[0]?.error.code).toBe('FILE_CORRUPT');
    expect(broken.files.paths()).toEqual([]);
  });

  it('stages the good file when one of several is refused', async () => {
    const { images, service } = harness();
    images.pickImages = async () => ({
      status: 'picked',
      limited: true,
      files: [
        pickedFile({ uri: 'file:///picked/notes.txt', name: 'notes.txt', mime: 'text/plain' }),
        pickedFile({ uri: 'file:///picked/photo.jpg' }),
      ],
    });

    const result = await service.importFromLibrary(REQUEST);

    expect(result.status).toBe('staged');
    if (result.status !== 'staged') return;
    expect(result.attachments).toHaveLength(1);
    expect(result.problems).toHaveLength(1);
    expect(result.limited).toBe(true);
  });

  it('shows the cap instead of copying the eleventh attachment', async () => {
    const { images, files, service } = harness();
    images.pickImages = async () => ({
      status: 'picked',
      limited: false,
      files: [pickedFile({ uri: 'file:///picked/photo.jpg' })],
    });

    const result = await service.importFromLibrary({ ...REQUEST, existingCount: 10 });

    expect(result.status).toBe('staged');
    if (result.status !== 'staged') return;
    expect(result.problems[0]?.message).toContain('up to 10');
    expect(files.paths()).toEqual([]);
  });

  it('passes cancellation and denial through without an error message', async () => {
    const { images, service } = harness();
    images.pickImages = async () => ({ status: 'cancelled' });
    expect((await service.importFromLibrary(REQUEST)).status).toBe('cancelled');

    images.pickImages = async () => ({ status: 'denied', limited: true });
    const denied = await service.importFromLibrary(REQUEST);
    expect(denied).toEqual({ status: 'denied', limited: true });
  });
});

describe('attachmentService save ordering', () => {
  async function stagedTwo() {
    const context = harness();
    context.images.pickImages = async () => ({
      status: 'picked',
      limited: false,
      files: [
        pickedFile({ uri: 'file:///picked/photo.jpg' }),
        pickedFile({ uri: 'file:///picked/photo.jpg' }),
      ],
    });
    const result = await context.service.importFromLibrary(REQUEST);
    if (result.status !== 'staged') throw new Error('staging failed');
    return { ...context, staged: result.attachments };
  }

  it('moves staged files into the record folder and returns the rows', async () => {
    const { files, service, staged } = await stagedTwo();

    const moved = await service.moveIntoPlace({ personId: 'p1', recordId: 'r1', staged });

    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.inputs.map((input) => [input.relPath, input.thumbRelPath])).toEqual([
      ['attachments/p1/r1/id1.jpg', 'thumbs/id1.jpg'],
      ['attachments/p1/r1/id2.jpg', 'thumbs/id2.jpg'],
    ]);
    expect(files.exists('attachments/p1/r1/id1.jpg')).toBe(true);
    expect(files.exists('thumbs/id2.jpg')).toBe(true);
    expect(files.listFiles('staging')).toEqual([]);
  });

  it('moves the files back into staging when the database write fails', async () => {
    const { files, service, staged } = await stagedTwo();
    await service.moveIntoPlace({ personId: 'p1', recordId: 'r1', staged });

    await service.rollbackToStaging({ personId: 'p1', recordId: 'r1', staged });

    expect(files.exists('staging/d1/id1.jpg')).toBe(true);
    expect(files.exists('staging/d1/thumbs/id2.jpg')).toBe(true);
    expect(files.exists('attachments/p1/r1/id1.jpg')).toBe(false);
    expect(files.exists('thumbs/id1.jpg')).toBe(false);
  });

  it('rolls back the files already moved when a later move fails', async () => {
    const { files, service, staged } = await stagedTwo();
    // Simulate a storage failure part-way through: the second staged file has disappeared.
    files.remove('staging/d1/id2.jpg');

    const moved = await service.moveIntoPlace({ personId: 'p1', recordId: 'r1', staged });

    expect(moved.ok).toBe(false);
    expect(files.exists('staging/d1/id1.jpg')).toBe(true);
    expect(files.exists('staging/d1/thumbs/id1.jpg')).toBe(true);
    expect(files.exists('attachments/p1/r1/id1.jpg')).toBe(false);
    expect(files.exists('thumbs/id1.jpg')).toBe(false);
  });

  it('deletes a removed attachment, a whole draft folder and stored files', async () => {
    const { files, service, staged } = await stagedTwo();
    const first = staged[0];
    if (!first) throw new Error('expected a staged attachment');

    await service.removeStaged([first]);
    expect(files.exists('staging/d1/id1.jpg')).toBe(false);
    expect(files.exists('staging/d1/thumbs/id1.jpg')).toBe(false);
    expect(files.exists('staging/d1/id2.jpg')).toBe(true);

    await service.discardDraft('d1');
    expect(files.listFiles('staging')).toEqual([]);

    files.seed('thumbs/a1.jpg', 'x');
    await service.deleteFiles(['thumbs/a1.jpg']);
    expect(files.exists('thumbs/a1.jpg')).toBe(false);
  });
});
