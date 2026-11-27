/**
 * The PDF renderer: first page to a JPEG.
 *
 * `react-native-pdf-thumbnail` (ADR-015) renders with PDFKit on iOS and PdfRenderer on Android,
 * both of which draw the page onto white. That property is what the PNG transparency path below
 * relies on as well.
 */
export interface PdfPageImage {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
}

export interface PdfThumbnailer {
  /** Renders page 1 at no more than `maxLongEdge` pixels on the long side. */
  renderFirstPage(uri: string, maxLongEdge: number): Promise<PdfPageImage>;
}

export const defaultPdfThumbnailer: PdfThumbnailer = {
  async renderFirstPage(uri: string, maxLongEdge: number): Promise<PdfPageImage> {
    // Imported lazily so a test that only needs the interface never loads the native module.
    const { default: PdfThumbnail } = await import('react-native-pdf-thumbnail');
    const page = await PdfThumbnail.generate(uri, 0, {
      quality: 80,
      maxWidth: maxLongEdge,
      maxHeight: maxLongEdge,
    });
    return { uri: page.uri, width: page.width, height: page.height };
  },
};
