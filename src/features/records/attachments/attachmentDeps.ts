/**
 * The real ports, wired once for the record screens.
 *
 * Screens call `getAttachmentService()` rather than constructing a pipeline inline, and tests build
 * the same service with fakes (`attachmentService.test.ts`).
 */
import { getFileStore } from '@/data';
import { uuidv7 } from '@/lib/ids';
import {
  defaultImageProcessor,
  defaultPdfThumbnailer,
  expoDocumentPicker,
  expoFileSharer,
  expoImageLibraryPicker,
} from '@/platform';

import { type AttachmentService, createAttachmentService } from './attachmentService';

let cached: AttachmentService | null = null;

export function getAttachmentService(): AttachmentService {
  cached ??= createAttachmentService({
    images: expoImageLibraryPicker,
    documents: expoDocumentPicker,
    processor: defaultImageProcessor,
    pdf: defaultPdfThumbnailer,
    files: getFileStore(),
    newId: uuidv7,
  });
  return cached;
}

/** The share sheet, for the PDF "Open" action on the detail screen. */
export { expoFileSharer as fileSharer };
