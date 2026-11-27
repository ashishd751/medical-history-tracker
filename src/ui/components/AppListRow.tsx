import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAppTheme } from '../ThemeProvider';
import { minTouchTarget, radius, spacing } from '../tokens';
import { AppText } from './AppText';

export interface AppListRowProps {
  title: string;
  subtitle?: string | undefined;
  meta?: string | undefined;
  badge?: ReactNode;
  trailing?: ReactNode;
  onPress?: (() => void) | undefined;
  accessibilityHint?: string | undefined;
  testID?: string;
}

/** Tappable row used by the records timeline and Home's recent list. */
export function AppListRow({
  title,
  subtitle,
  meta,
  badge,
  trailing,
  onPress,
  accessibilityHint,
  testID,
}: AppListRowProps) {
  const { colors } = useAppTheme();

  // One label for the whole row: the inner texts are hidden from a screen reader as soon as the
  // Pressable is accessible, so the value, its date and where it came from must be repeated here
  // (otherwise VoiceOver reads "70 kg" and nothing else).
  const label = [title, subtitle, meta].filter(Boolean).join(', ');

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.surfaceVariant : colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.main}>
        {badge ? <View>{badge}</View> : null}
        <AppText variant="body" style={styles.title} numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="muted" numberOfLines={3}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {meta || trailing ? (
        <View style={styles.side}>
          {meta ? (
            <AppText variant="caption" color="muted">
              {meta}
            </AppText>
          ) : null}
          {trailing}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  main: { flex: 1, gap: 2 },
  // The type badge is a 13 pt caption; the title carries the row at 16 pt semibold, so the type can
  // never look larger than the record it describes.
  title: { fontWeight: '600' },
  side: { alignItems: 'flex-end', gap: 2 },
});
