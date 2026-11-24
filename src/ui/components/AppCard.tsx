import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card as PaperCard } from 'react-native-paper';

import { useAppTheme } from '../ThemeProvider';
import { radius, spacing } from '../tokens';

export interface AppCardProps {
  children: ReactNode;
  /** Screens use `quiet` for secondary groupings to keep the hierarchy flat. */
  variant?: 'default' | 'quiet';
  accessibilityLabel?: string | undefined;
  testID?: string;
}

/** Surface container: 12pt radius, minimal elevation, consistent padding. */
export function AppCard({
  children,
  variant = 'default',
  accessibilityLabel,
  testID,
}: AppCardProps) {
  const { colors } = useAppTheme();
  return (
    <PaperCard
      mode="contained"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        styles.card,
        { backgroundColor: variant === 'quiet' ? colors.surfaceVariant : colors.surface },
      ]}
    >
      <View style={styles.content}>{children}</View>
    </PaperCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    elevation: 0,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
