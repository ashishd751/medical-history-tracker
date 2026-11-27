/**
 * Image preparation: rotation fix, resize, JPEG encode, white flattening.
 *
 * `expo-image-manipulator` bakes the EXIF orientation into the pixels when the image is loaded
 * (its iOS module starts with `ImageFixOrientationTransformer`, and Android decodes through Glide,
 * which applies the EXIF orientation), so the file we store is upright without relying on a tag.
 *
 * JPEG has no alpha channel, and both platforms' JPEG encoders drop the alpha channel without
 * compositing — transparent pixels become black. A PNG with transparency (a screenshot of a lab
 * report is the common case) is therefore drawn onto a white PDF page first and that page is
 * rendered back to JPEG. PDF pages are white, so the transparent areas stay white. That is the only
 * installed rasteriser that can produce this; see ADR-031.
 */
import { EncodingType, readAsStringAsync } from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { printToFileAsync } from 'expo-print';

import { defaultPdfThumbnailer, type PdfThumbnailer } from './pdfThumbnail';

export interface ProcessedImage {
  /** A `file://` URI in the platform's cache directory. */
  readonly uri: string;
  readonly width: number;
  readonly height: number;
}

export interface ImageProcessor {
  /**
   * Returns a JPEG no larger than `maxLongEdge` on its long side.
   *
   * `flattenTransparency` must be true for PNG sources: it composites them onto white instead of
   * letting the JPEG encoder turn transparent pixels black.
   */
  prepareJpeg(input: {
    readonly uri: string;
    readonly maxLongEdge: number;
    /** 0–1, passed to the encoder. */
    readonly compress: number;
    readonly flattenTransparency: boolean;
  }): Promise<ProcessedImage>;
}

/** Draws the image on a white PDF page and renders it back, which keeps transparent areas white. */
async function flattenOnWhite(
  image: { uri: string; width: number; height: number },
  maxLongEdge: number,
  pdf: PdfThumbnailer,
): Promise<ProcessedImage> {
  const width = Math.max(1, Math.round(image.width));
  const height = Math.max(1, Math.round(image.height));
  const base64 = await readAsStringAsync(image.uri, { encoding: EncodingType.Base64 });

  const html = `<!doctype html><html><head><style>
    @page { margin: 0; size: ${width}px ${height}px; }
    html, body { margin: 0; padding: 0; background: #ffffff; }
    img { display: block; width: ${width}px; height: ${height}px; }
  </style></head><body><img src="data:image/png;base64,${base64}" /></body></html>`;

  const printed = await printToFileAsync({
    html,
    width,
    height,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  const page = await pdf.renderFirstPage(printed.uri, maxLongEdge);
  return { uri: page.uri, width: page.width, height: page.height };
}

export function createImageProcessor(pdf: PdfThumbnailer = defaultPdfThumbnailer): ImageProcessor {
  return {
    async prepareJpeg({ uri, maxLongEdge, compress, flattenTransparency }) {
      // `maxWidth`/`maxHeight` down-sample while decoding, so a 12-megapixel photo never enters
      // memory at full size and a smaller image is never upscaled.
      const context = ImageManipulator.manipulate(uri, {
        maxWidth: maxLongEdge,
        maxHeight: maxLongEdge,
      });
      const rendered = await context.renderAsync();

      if (!flattenTransparency) {
        return rendered.saveAsync({ compress, format: SaveFormat.JPEG });
      }

      const png = await rendered.saveAsync({ format: SaveFormat.PNG });
      try {
        return await flattenOnWhite(png, maxLongEdge, pdf);
      } catch (error) {
        // A flattened image is nicer, not essential: never lose the attachment over it.
        console.warn('Could not flatten transparency; encoding directly instead.', {
          error: String(error),
        });
        return rendered.saveAsync({ compress, format: SaveFormat.JPEG });
      }
    },
  };
}

export const defaultImageProcessor: ImageProcessor = createImageProcessor();
