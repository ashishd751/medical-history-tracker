import { StyleSheet, View } from 'react-native';

import type { AttachmentRow, FileStore } from '@/data';
import { ATTACHMENT_ROLE_ORDER, type AttachmentRole, isPdf } from '@/domain';
import { AppButton, AppText, attachmentRoleLabel, spacing, strings } from '@/ui';

import { AttachmentGrid, type AttachmentGridItem } from './AttachmentGrid';

export interface GalleryItem extends AttachmentGridItem {
  /** A PDF cannot be shown in-app, so it carries an Open action instead of a zoom viewer. */
  readonly shareable: boolean;
}

export interface GalleryGroup {
  readonly role: AttachmentRole;
  readonly items: readonly GalleryItem[];
}

/**
 * Groups stored attachments by role, resolving thumbnails through the file store.
 *
 * A row whose thumbnail is gone still appears, with the "File missing" placeholder: the record
 * still says a file exists, and hiding it would look like data loss (ADR-034).
 */
export function groupAttachments(
  attachments: readonly AttachmentRow[],
  files: Pick<FileStore, 'exists' | 'toUri'>,
): GalleryGroup[] {
  return ATTACHMENT_ROLE_ORDER.map((role) => ({
    role,
    items: attachments
      .filter((row) => row.role === role)
      .map((row) => ({
        id: row.id,
        label: attachmentRoleLabel(row.role),
        thumbnailUri:
          row.thumbRelPath && files.exists(row.thumbRelPath) ? files.toUri(row.thumbRelPath) : null,
        shareable: isPdf(row.mime),
      })),
  }));
}

export interface AttachmentGalleryProps {
  groups: readonly GalleryGroup[];
  onOpen: (id: string) => void;
  onShare: (id: string) => void;
  testID?: string;
}

/**
 * The record detail's attachment area, grouped by role.
 *
 * An image opens in the zoom viewer. A PDF shows its first-page thumbnail and an Open action that
 * hands the file to another app through the share sheet (ADR-033).
 */
export function AttachmentGallery({ groups, onOpen, onShare, testID }: AttachmentGalleryProps) {
  const visible = groups.filter((group) => group.items.length > 0);
  if (visible.length === 0) return null;

  return (
    <View style={styles.container} testID={testID}>
      {visible.map((group) => (
        <View key={group.role} style={styles.group} testID={`gallery-${group.role}`}>
          <AppText variant="label">{attachmentRoleLabel(group.role)}</AppText>
          <AttachmentGrid items={group.items} onOpen={onOpen} />
          {group.items.some((item) => item.shareable) ? (
            <View style={styles.openRow}>
              {group.items
                .filter((item) => item.shareable)
                .map((item) => (
                  <AppButton
                    key={item.id}
                    label={`${strings.attachments.open} ${item.label}`}
                    variant="quiet"
                    onPress={() => onShare(item.id)}
                    accessibilityHint={strings.attachments.openHint}
                    testID={`open-attachment-${item.id}`}
                  />
                ))}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  group: { gap: spacing.sm },
  openRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
