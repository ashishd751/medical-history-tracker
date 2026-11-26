import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getFileStore, requireRepositories } from '@/data';
import { isPdf } from '@/domain';
import { useSession } from '@/lib/session';
import {
  AppBanner,
  AppButton,
  AppEmptyState,
  AppScreen,
  AppText,
  AppThumbnail,
  AppZoomableImage,
  attachmentRoleLabel,
  spacing,
  strings,
} from '@/ui';

import { fileSharer } from './attachmentDeps';

/**
 * The full-screen viewer for one attachment (route `app/attachment/[id]`).
 *
 * An image is pannable and zoomable in place. A PDF is not rendered by this app, so it shows its
 * first page and an Open action that shares the file with a reader the user chooses.
 */
export function AttachmentViewerScreen({ attachmentId }: { attachmentId: string }) {
  const { personId } = useSession();
  const router = useRouter();
  const [banner, setBanner] = useState<string | null>(null);

  const attachment = useMemo(
    () => requireRepositories().attachments.getById(attachmentId),
    [attachmentId],
  );
  const owned = useMemo(
    () =>
      attachment && personId
        ? requireRepositories().records.getDetail(personId, attachment.recordId) !== null
        : false,
    [attachment, personId],
  );

  if (!attachment || !owned) {
    return (
      <AppScreen title={strings.attachments.viewerTitle} onBack={() => router.back()}>
        <AppEmptyState title={strings.attachments.fileMissing} />
      </AppScreen>
    );
  }

  const files = getFileStore();
  const label = attachmentRoleLabel(attachment.role);
  const fullUri = files.exists(attachment.relPath) ? files.toUri(attachment.relPath) : null;
  const thumbUri =
    attachment.thumbRelPath && files.exists(attachment.thumbRelPath)
      ? files.toUri(attachment.thumbRelPath)
      : null;
  const pdf = isPdf(attachment.mime);

  const share = async (): Promise<void> => {
    if (!fullUri) return;
    try {
      const outcome = await fileSharer.share(fullUri, {
        mimeType: attachment.mime,
        title: label,
      });
      if (outcome === 'unavailable') setBanner(strings.attachments.shareUnavailable);
    } catch {
      setBanner(strings.attachments.shareUnavailable);
    }
  };

  return (
    <AppScreen
      title={label}
      onBack={() => router.back()}
      scroll={false}
      safeAreaBottom
      testID="screen-attachment-viewer"
    >
      {banner ? <AppBanner tone="warning" message={banner} testID="viewer-banner" /> : null}

      {pdf ? (
        <View style={styles.pdf}>
          <AppThumbnail
            uri={thumbUri}
            placeholder={strings.attachments.fileMissing}
            size={280}
            accessibilityLabel={strings.attachments.thumbnailAlt(label)}
            testID="viewer-pdf-page"
          />
          <AppText variant="caption" color="muted">
            {strings.attachments.openHint}
          </AppText>
          <AppButton
            label={strings.attachments.open}
            onPress={() => void share()}
            disabled={!fullUri}
            testID="viewer-open-pdf"
          />
        </View>
      ) : fullUri ? (
        <AppZoomableImage
          uri={fullUri}
          accessibilityLabel={strings.attachments.thumbnailAlt(label)}
          testID="viewer-image"
        />
      ) : (
        <AppEmptyState title={strings.attachments.fileMissing} />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  pdf: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
});
