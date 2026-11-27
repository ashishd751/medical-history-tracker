/**
 * Device capabilities, each behind an interface with one implementation (plus a fake in
 * `./testing`). Features depend on the interfaces; only the app's wiring and the feature's
 * dependency module import the Expo implementations.
 */
export { type DocumentPicker, expoDocumentPicker } from './documentPicker';
export { expoExportFiles, type ExportFiles, EXPORTS_DIR } from './exportFiles';
export { expoFileSharer, type FileSharer } from './fileSharer';
export { expoImageLibraryPicker, type ImageLibraryPicker } from './imageLibraryPicker';
export {
  createImageProcessor,
  defaultImageProcessor,
  type ImageProcessor,
  type ProcessedImage,
} from './imageProcessor';
export { expoPdfPrinter, type PdfPageRequest, type PdfPrinter, type PdfResult } from './pdfPrinter';
export { defaultPdfThumbnailer, type PdfPageImage, type PdfThumbnailer } from './pdfThumbnail';
export type { PickedFile, PickOutcome } from './pickerTypes';
