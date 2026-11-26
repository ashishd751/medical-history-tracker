/**
 * The photo-library picker — the library only, never the camera.
 *
 * There is no `launchCameraAsync` call anywhere in this app and the `expo-image-picker` plugin is
 * configured with `cameraPermission: false`, which removes the Android camera permission. On both
 * platforms this opens the system photo picker, which runs out of process: it can read the photos
 * the user taps without the app holding a library permission at all.
 *
 * The permission is therefore only *read* (never requested) so the UI can say "only selected photos
 * are available" when the user has granted limited access.
 */
import * as ImagePicker from 'expo-image-picker';

import type { PickOutcome } from './pickerTypes';

export interface ImageLibraryPicker {
  /** Opens the system photo picker. Multiple selection is allowed. */
  pickImages(): Promise<PickOutcome>;
}

export const expoImageLibraryPicker: ImageLibraryPicker = {
  async pickImages(): Promise<PickOutcome> {
    try {
      const permission = await ImagePicker.getMediaLibraryPermissionsAsync();
      const limited = permission.accessPrivileges === 'limited';

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        // Cropping would force a single selection and change the user's document.
        allowsEditing: false,
        // Keep the original bytes: the import pipeline owns resizing and compression.
        quality: 1,
        exif: false,
      });

      if (result.canceled) return { status: 'cancelled' };

      return {
        status: 'picked',
        limited,
        files: result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.fileName ?? '',
          mime: asset.mimeType ?? '',
          bytes: asset.fileSize ?? 0,
        })),
      };
    } catch (error) {
      return { status: 'failed', detail: String(error) };
    }
  },
};
