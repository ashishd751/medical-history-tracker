/**
 * HTML → PDF, behind a port (Phase 4).
 *
 * `expo-print` renders the HTML in a WebView and writes the result into the app's **cache**
 * directory under a name of its own choosing. The page size is passed explicitly: `width` and
 * `height` (points at 72 PPI) are the only page-size control that behaves the same on both
 * platforms — `orientation` exists only on `printAsync` and only on iOS, so it is not used
 * (ADR-048).
 */
import * as Print from 'expo-print';

export interface PdfPageRequest {
  readonly html: string;
  /** Page width in points at 72 PPI; A4 portrait is 595. */
  readonly width: number;
  /** Page height in points at 72 PPI; A4 portrait is 842. */
  readonly height: number;
}

export interface PdfResult {
  /** A `file://` URI inside the cache directory. Moved and renamed before it is shared. */
  readonly uri: string;
  readonly numberOfPages: number;
}

export interface PdfPrinter {
  print(request: PdfPageRequest): Promise<PdfResult>;
}

export const expoPdfPrinter: PdfPrinter = {
  async print({ html, width, height }) {
    const result = await Print.printToFileAsync({ html, width, height });
    return { uri: result.uri, numberOfPages: result.numberOfPages };
  },
};
