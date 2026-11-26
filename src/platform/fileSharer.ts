/**
 * Handing a stored file to another app.
 *
 * The app cannot display a PDF itself (there is no PDF viewer dependency), so "Open" shares the
 * file through the system sheet: the user picks the reader. This is also the escape hatch for an
 * unsupported image, and it never touches the network. See ADR-033.
 */
import * as Sharing from 'expo-sharing';

export interface FileSharer {
  /** `shared` when the sheet was presented, `unavailable` when the platform cannot share. */
  share(
    uri: string,
    options: { readonly mimeType: string; readonly title: string },
  ): Promise<'shared' | 'unavailable'>;
}

export const expoFileSharer: FileSharer = {
  async share(uri, { mimeType, title }) {
    if (!(await Sharing.isAvailableAsync())) return 'unavailable';
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: title });
    return 'shared';
  },
};
