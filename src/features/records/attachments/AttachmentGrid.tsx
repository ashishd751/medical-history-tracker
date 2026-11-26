import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, AppThumbnail, spacing, strings } from '@/ui';

/** One stored (or staged) file, already resolved to a URI the view can draw. */
export interface AttachmentGridItem {
  readonly id: string;
  /** Role label, used for the caption and the screen-reader label. */
  readonly label: string;
  /** Absolute thumbnail URI, or null when the thumbnail file is missing. */
  readonly thumbnailUri: string | null;
}

export interface AttachmentGridProps {
  items: readonly AttachmentGridItem[];
  /** Tapping a tile opens the viewer. */
  onOpen?: (id: string) => void;
  /** Removes the attachment (form only; removal takes effect on save). */
  onRemove?: (id: string) => void;
  testID?: string;
}

const TILE = 96;

/** A wrapping row of file previews, shared by the form and the record detail screen. */
export function AttachmentGrid({ items, onOpen, onRemove, testID }: AttachmentGridProps) {
  return (
    <View style={styles.grid} testID={testID}>
      {items.map((item) => (
        <View key={item.id} style={styles.tile}>
          <Pressable
            disabled={!onOpen}
            onPress={() => onOpen?.(item.id)}
            accessibilityRole={onOpen ? 'button' : undefined}
            accessibilityLabel={onOpen ? `${item.label}: ${strings.attachments.open}` : item.label}
          >
            <AppThumbnail
              uri={item.thumbnailUri}
              placeholder={strings.attachments.fileMissing}
              size={TILE}
              accessibilityLabel={strings.attachments.thumbnailAlt(item.label)}
              testID={`attachment-tile-${item.id}`}
            />
          </Pressable>
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {item.label}
          </AppText>
          {onRemove ? (
            <Pressable
              onPress={() => onRemove(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`${strings.common.remove}: ${item.label}`}
              hitSlop={spacing.sm}
              testID={`remove-attachment-${item.id}`}
            >
              <AppText variant="caption" color="danger">
                {strings.common.remove}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { width: TILE, gap: spacing.xs },
});
