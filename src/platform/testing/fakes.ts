/**
 * Fakes for the platform ports (ADR-032).
 *
 * They are plain objects with recorded interactions, so a service or a component test never loads
 * a native module and never needs a device. Only tests import this module.
 */
import type { DocumentPicker } from '../documentPicker';
import type { ExportFiles } from '../exportFiles';
import type { FileSharer } from '../fileSharer';
import type { ImageLibraryPicker } from '../imageLibraryPicker';
import type { ImageProcessor, ProcessedImage } from '../imageProcessor';
import type { PdfPageRequest, PdfPrinter, PdfResult } from '../pdfPrinter';
import type { PdfPageImage, PdfThumbnailer } from '../pdfThumbnail';
import type { PickedFile, PickOutcome } from '../pickerTypes';

/** A synthetic picked file; never a real one. */
export function pickedFile(overrides: Partial<PickedFile> = {}): PickedFile {
  return {
    uri: 'file:///fake/picked.jpg',
    name: 'synthetic-photo.jpg',
    mime: 'image/jpeg',
    bytes: 120_000,
    ...overrides,
  };
}

function queue<T>(outcomes: readonly T[], fallback: T) {
  let index = 0;
  return () => {
    const value = outcomes[index] ?? fallback;
    index += 1;
    return value;
  };
}

export interface ImageLibraryPickerFake extends ImageLibraryPicker {
  readonly calls: () => number;
}

export function createFakeImageLibraryPicker(
  outcomes: readonly PickOutcome[] = [{ status: 'cancelled' }],
): ImageLibraryPickerFake {
  let calls = 0;
  const next = queue(outcomes, { status: 'cancelled' });
  return {
    calls: () => calls,
    async pickImages() {
      calls += 1;
      return next();
    },
  };
}

export interface DocumentPickerFake extends DocumentPicker {
  readonly calls: () => number;
}

export function createFakeDocumentPicker(
  outcomes: readonly PickOutcome[] = [{ status: 'cancelled' }],
): DocumentPickerFake {
  let calls = 0;
  const next = queue(outcomes, { status: 'cancelled' });
  return {
    calls: () => calls,
    async pickDocuments() {
      calls += 1;
      return next();
    },
  };
}

export interface ImageProcessorCall {
  readonly uri: string;
  readonly maxLongEdge: number;
  readonly compress: number;
  readonly flattenTransparency: boolean;
}

export interface ImageProcessorFake extends ImageProcessor {
  readonly calls: ImageProcessorCall[];
}

export function createFakeImageProcessor(
  options: { readonly fail?: boolean; readonly size?: number } = {},
): ImageProcessorFake {
  const calls: ImageProcessorCall[] = [];
  return {
    calls,
    async prepareJpeg(input): Promise<ProcessedImage> {
      calls.push(input);
      if (options.fail) throw new Error('fake image processor failure');
      const size = options.size ?? Math.min(input.maxLongEdge, 2000);
      return {
        uri: `file:///fake/processed-${calls.length}.jpg`,
        width: size,
        height: Math.round(size / 2),
      };
    },
  };
}

export interface PdfThumbnailerFake extends PdfThumbnailer {
  readonly calls: { uri: string; maxLongEdge: number }[];
}

export function createFakePdfThumbnailer(
  options: { readonly fail?: boolean } = {},
): PdfThumbnailerFake {
  const calls: { uri: string; maxLongEdge: number }[] = [];
  return {
    calls,
    async renderFirstPage(uri, maxLongEdge): Promise<PdfPageImage> {
      calls.push({ uri, maxLongEdge });
      if (options.fail) throw new Error('fake pdf renderer failure');
      return { uri: `file:///fake/page-${calls.length}.jpg`, width: 400, height: 566 };
    },
  };
}

export interface FileSharerFake extends FileSharer {
  readonly calls: { uri: string; mimeType: string }[];
  /** Set false to simulate a platform without a share sheet. */
  available: boolean;
}

export function createFakeFileSharer(): FileSharerFake {
  const calls: { uri: string; mimeType: string }[] = [];
  const fake: FileSharerFake = {
    calls,
    available: true,
    async share(uri, { mimeType }) {
      if (!fake.available) return 'unavailable';
      calls.push({ uri, mimeType });
      return 'shared';
    },
  };
  return fake;
}

export interface PdfPrinterFake extends PdfPrinter {
  readonly calls: PdfPageRequest[];
  /** Set true to simulate a rendering failure. */
  fail: boolean;
  /** Pages the fake reports; the real count comes from the print engine. */
  pages: number;
}

export function createFakePdfPrinter(options: { readonly pages?: number } = {}): PdfPrinterFake {
  const calls: PdfPageRequest[] = [];
  const fake: PdfPrinterFake = {
    calls,
    fail: false,
    pages: options.pages ?? 1,
    async print(request): Promise<PdfResult> {
      calls.push(request);
      if (fake.fail) throw new Error('fake pdf printer failure');
      return { uri: `file:///fake/cache/Print/${calls.length}.pdf`, numberOfPages: fake.pages };
    },
  };
  return fake;
}

export interface ExportFilesFake extends ExportFiles {
  readonly adopted: { tempUri: string; fileName: string }[];
  /** File names currently in the fake cache folder. */
  readonly files: string[];
  /** Total files removed by every `clearPrevious` call. */
  cleared: number;
  /** Set true to simulate a file move that fails. */
  fail: boolean;
}

export function createFakeExportFiles(initialFiles: readonly string[] = []): ExportFilesFake {
  const fake: ExportFilesFake = {
    adopted: [],
    files: [...initialFiles],
    cleared: 0,
    fail: false,
    async adopt(tempUri, fileName) {
      if (fake.fail) throw new Error('fake export files failure');
      fake.adopted.push({ tempUri, fileName });
      if (!fake.files.includes(fileName)) fake.files.push(fileName);
      return `file:///fake/cache/exports/${fileName}`;
    },
    async clearPrevious() {
      const removed = fake.files.length;
      fake.files.length = 0;
      fake.cleared += removed;
      return removed;
    },
  };
  return fake;
}
