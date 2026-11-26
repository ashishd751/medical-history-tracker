/**
 * The document picker (Files on iOS, the system document UI on Android).
 *
 * Used for both PDFs and images that are not in the photo library. `copyToCacheDirectory` is on so
 * the returned URI is readable at once; the import pipeline copies from it into staging and the
 * cache copy can then be forgotten.
 */
import * as ExpoDocumentPicker from 'expo-document-picker';

import type { PickOutcome } from './pickerTypes';

export interface DocumentPicker {
  /** Opens the system document picker. Multiple selection is allowed. */
  pickDocuments(): Promise<PickOutcome>;
}

export const expoDocumentPicker: DocumentPicker = {
  async pickDocuments(): Promise<PickOutcome> {
    try {
      const result = await ExpoDocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled) return { status: 'cancelled' };

      return {
        status: 'picked',
        limited: false,
        files: result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.name,
          mime: asset.mimeType ?? '',
          bytes: asset.size ?? 0,
        })),
      };
    } catch (error) {
      return { status: 'failed', detail: String(error) };
    }
  },
};
